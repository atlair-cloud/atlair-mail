import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  SESv2Client,
  TooManyRequestsException,
} from "@aws-sdk/client-sesv2";
import { createDomainIdentity, getDomainIdentity, toDomainStatus } from "../src/lib/ses-identities.ts";

const credentials = { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "secret" };
const dkim = { Tokens: ["t1", "t2", "t3"], SigningHostedZone: "dkim.amazonses.com", Status: "PENDING" as const };
const ses = mockClient(SESv2Client);

const sesError = <T>(Type: new (opts: { message: string; $metadata: object }) => T) =>
  new Type({ message: "x", $metadata: {} });

beforeEach(() => ses.reset());

describe("SES domain identities", () => {
  it("maps SES verification to domain status", () => {
    assert.equal(toDomainStatus("SUCCESS", true), "verified");
    assert.equal(toDomainStatus("SUCCESS", false), "pending");
    assert.equal(toDomainStatus("FAILED", false), "failed");
    assert.equal(toDomainStatus("TEMPORARY_FAILURE", false), "pending");
    assert.equal(toDomainStatus("NOT_STARTED", false), "pending");
    assert.equal(toDomainStatus(undefined, undefined), "pending");
  });

  it("creates an identity with 2048-bit Easy DKIM and returns its tokens", async () => {
    ses.on(CreateEmailIdentityCommand).resolves({ DkimAttributes: dkim, VerifiedForSendingStatus: false });

    const identity = await createDomainIdentity(credentials, "example.com");

    assert.deepEqual(identity, {
      status: "pending",
      dkimTokens: ["t1", "t2", "t3"],
      dkimSigningHostedZone: "dkim.amazonses.com",
    });
    assert.deepEqual(ses.commandCalls(CreateEmailIdentityCommand)[0]!.args[0].input, {
      EmailIdentity: "example.com",
      DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
    });
  });

  it("adopts an identity that already exists in the SES account", async () => {
    ses.on(CreateEmailIdentityCommand).rejects(sesError(AlreadyExistsException));
    ses.on(GetEmailIdentityCommand).resolves({
      DkimAttributes: { ...dkim, Status: "SUCCESS" },
      VerificationStatus: "SUCCESS",
      VerifiedForSendingStatus: true,
    });

    assert.equal((await createDomainIdentity(credentials, "example.com")).status, "verified");
  });

  it("returns null when the identity is not in this region", async () => {
    ses.on(GetEmailIdentityCommand).rejects(sesError(NotFoundException));

    assert.equal(await getDomainIdentity(credentials, "example.com"), null);
  });

  it("maps throttling to 429 and never puts credentials in the error", async () => {
    ses.on(GetEmailIdentityCommand).rejects(sesError(TooManyRequestsException));

    await assert.rejects(getDomainIdentity(credentials, "example.com"), (error: Error & { statusCode: number }) => {
      return error.statusCode === 429 && !JSON.stringify(error).includes(credentials.secretAccessKey);
    });
  });
});
