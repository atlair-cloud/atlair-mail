import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  SESv2Client,
  SESv2ServiceException,
  TooManyRequestsException,
} from "@aws-sdk/client-sesv2";
import { createProvider, ProviderError } from "../src/index.ts";
import { toDomainStatus } from "../src/ses/ses-provider.ts";

const secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const provider = createProvider({
  type: "ses",
  settings: { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
  secrets: { secretAccessKey },
}, { retry: false });
const dkim = { Tokens: ["t1", "t2", "t3"], SigningHostedZone: "dkim.example-zone.com", Status: "PENDING" as const };
const ses = mockClient(SESv2Client);

const sesError = <T>(Type: new (opts: { message: string; $metadata: object }) => T) =>
  new Type({ message: "x", $metadata: {} });

const expectProviderError = (code: string, statusCode: number) => (error: unknown) =>
  error instanceof ProviderError &&
  error.code === code &&
  error.statusCode === statusCode &&
  !JSON.stringify({ ...error, message: error.message }).includes(secretAccessKey);

beforeEach(() => ses.reset());

describe("SES provider", () => {
  it("maps SES verification to domain status", () => {
    assert.equal(toDomainStatus("SUCCESS", true), "verified");
    assert.equal(toDomainStatus("SUCCESS", false), "pending");
    assert.equal(toDomainStatus("FAILED", false), "failed");
    assert.equal(toDomainStatus("TEMPORARY_FAILURE", false), "pending");
    assert.equal(toDomainStatus("NOT_STARTED", false), "pending");
    assert.equal(toDomainStatus(undefined, undefined), "pending");
  });

  it("reports the account in provider-neutral terms", async () => {
    ses.on(GetAccountCommand).resolves({
      SendingEnabled: true,
      ProductionAccessEnabled: false,
      SendQuota: { Max24HourSend: 200, MaxSendRate: 1 },
    });

    assert.deepEqual(await provider.verifyAccount(), {
      sendingEnabled: true,
      sandbox: true,
      dailyQuota: 200,
      maxSendRate: 1,
    });
  });

  it("creates a domain with 2048-bit DKIM and returns its DNS records", async () => {
    ses.on(CreateEmailIdentityCommand).resolves({ DkimAttributes: dkim, VerifiedForSendingStatus: false });

    const domain = await provider.createDomain("example.com");

    assert.equal(domain.status, "pending");
    assert.deepEqual(domain.dnsRecords[0], {
      record: "DKIM",
      type: "CNAME",
      name: "t1._domainkey.example.com",
      value: "t1.dkim.example-zone.com",
      required: true,
    });
    assert.equal(domain.dnsRecords.length, 3);
    assert.deepEqual(ses.commandCalls(CreateEmailIdentityCommand)[0]!.args[0].input, {
      EmailIdentity: "example.com",
      DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
    });
  });

  it("adopts a domain that already exists in the account", async () => {
    ses.on(CreateEmailIdentityCommand).rejects(sesError(AlreadyExistsException));
    ses.on(GetEmailIdentityCommand).resolves({
      DkimAttributes: { ...dkim, Status: "SUCCESS" },
      VerificationStatus: "SUCCESS",
      VerifiedForSendingStatus: true,
    });

    assert.equal((await provider.createDomain("example.com")).status, "verified");
  });

  it("returns null for a domain the account does not have", async () => {
    ses.on(GetEmailIdentityCommand).rejects(sesError(NotFoundException));

    assert.equal(await provider.getDomain("example.com"), null);
  });

  it("maps failures to provider errors without secrets", async () => {
    ses.on(GetAccountCommand).rejects(sesError(TooManyRequestsException));
    await assert.rejects(provider.verifyAccount(), expectProviderError("ATL_PROVIDER_THROTTLED", 429));

    ses.on(GetAccountCommand).rejects(
      new SESv2ServiceException({ name: "UnrecognizedClientException", $fault: "client", $metadata: {}, message: "x" }),
    );
    await assert.rejects(provider.verifyAccount(), (error: Error) => {
      return expectProviderError("ATL_PROVIDER_REJECTED", 422)(error) && /UnrecognizedClientException/.test(error.message);
    });

    ses.on(GetAccountCommand).rejects(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    await assert.rejects(provider.verifyAccount(), expectProviderError("ATL_PROVIDER_UNAVAILABLE", 502));

    ses.on(GetAccountCommand).rejects(
      new SESv2ServiceException({ name: "InternalFailure", $fault: "server", $metadata: {}, message: "x" }),
    );
    await assert.rejects(provider.verifyAccount(), expectProviderError("ATL_PROVIDER_UNAVAILABLE", 502));

    ses.on(GetAccountCommand).rejects(Object.assign(new Error("socket hang up"), { name: "TimeoutError" }));
    await assert.rejects(provider.verifyAccount(), expectProviderError("ATL_PROVIDER_TIMEOUT", 504));
  });
});
