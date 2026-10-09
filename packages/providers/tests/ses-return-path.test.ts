import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { createProvider } from "../src/index.ts";

const provider = createProvider(
  {
    type: "ses",
    settings: { region: "ap-south-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
    secrets: { secretAccessKey: "secret" },
  },
  { retry: false },
);
const ses = mockClient(SESv2Client);
const verifiedIdentity = {
  VerificationStatus: "SUCCESS" as const,
  VerifiedForSendingStatus: true,
  DkimAttributes: { Tokens: ["t1"], SigningHostedZone: "dkim.amazonses.com", Status: "SUCCESS" as const },
};

beforeEach(() => ses.reset());

describe("SES return path (custom MAIL FROM)", () => {
  it("configures bounce.<domain> and keeps sending if the MX record is missing", async () => {
    ses.on(PutEmailIdentityMailFromAttributesCommand).resolves({});

    await provider.configureReturnPath("mail.atlair.cloud");

    assert.deepEqual(ses.commandCalls(PutEmailIdentityMailFromAttributesCommand)[0]!.args[0].input, {
      EmailIdentity: "mail.atlair.cloud",
      MailFromDomain: "bounce.mail.atlair.cloud",
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    });
  });

  it("returns the MX and SPF records with their status", async () => {
    for (const [sesStatus, status] of [
      ["PENDING", "pending"],
      ["SUCCESS", "verified"],
      ["TEMPORARY_FAILURE", "pending"],
      ["FAILED", "failed"],
    ] as const) {
      ses.on(GetEmailIdentityCommand).resolves({
        ...verifiedIdentity,
        MailFromAttributes: {
          MailFromDomain: "bounce.mail.atlair.cloud",
          MailFromDomainStatus: sesStatus,
          BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
        },
      });

      const records = (await provider.getDomain("mail.atlair.cloud"))!.dnsRecords;

      assert.deepEqual(records.slice(1), [
        {
          record: "MAIL_FROM",
          type: "MX",
          name: "bounce.mail.atlair.cloud",
          value: "feedback-smtp.ap-south-1.amazonses.com",
          priority: 10,
          required: false,
          status,
        },
        {
          record: "SPF",
          type: "TXT",
          name: "bounce.mail.atlair.cloud",
          value: "v=spf1 include:amazonses.com ~all",
          required: false,
          status,
        },
      ]);
    }
  });

  it("returns only DKIM records when no return path is configured", async () => {
    ses.on(GetEmailIdentityCommand).resolves(verifiedIdentity);

    const records = (await provider.getDomain("mail.atlair.cloud"))!.dnsRecords;

    assert.deepEqual(
      records.map((record) => record.record),
      ["DKIM"],
    );
  });
});
