import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockClient } from "aws-sdk-client-mock";
import {
  AccountSuspendedException,
  LimitExceededException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
  SendEmailCommand,
  SendingPausedException,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { createProvider, ProviderError } from "../src/index.ts";
import { formatAddress } from "../src/ses/ses-provider.ts";

const provider = createProvider({
  type: "ses",
  settings: { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
  secrets: { secretAccessKey: "secret" },
}, { retry: false });
const ses = mockClient(SESv2Client);

const message = {
  from: { name: "Acme", address: "hello@example.com" },
  to: [{ address: "ada@example.org" }],
  cc: [{ name: "Grace Hopper", address: "grace@example.org" }],
  bcc: [{ address: "audit@example.com" }],
  replyTo: [{ address: "support@example.com" }],
  subject: "Welcome",
  html: "<p>Hi</p>",
  text: "Hi",
  headers: { "List-Unsubscribe": "<mailto:unsubscribe@example.com>" },
  tags: [{ name: "campaign", value: "welcome" }],
};

const sesError = <T>(Type: new (opts: { message: string; $metadata: object }) => T) =>
  new Type({ message: "x", $metadata: {} });

beforeEach(() => ses.reset());

describe("SES send", () => {
  it("sends simple content and returns the provider message id", async () => {
    ses.on(SendEmailCommand).resolves({ MessageId: "0100018f-abc" });

    const result = await provider.send(message);

    assert.deepEqual(result, { providerMessageId: "0100018f-abc" });
    assert.deepEqual(ses.commandCalls(SendEmailCommand)[0]!.args[0].input, {
      FromEmailAddress: '"Acme" <hello@example.com>',
      Destination: {
        ToAddresses: ["ada@example.org"],
        CcAddresses: ['"Grace Hopper" <grace@example.org>'],
        BccAddresses: ["audit@example.com"],
      },
      ReplyToAddresses: ["support@example.com"],
      Content: {
        Simple: {
          Subject: { Data: "Welcome", Charset: "UTF-8" },
          Body: { Html: { Data: "<p>Hi</p>", Charset: "UTF-8" }, Text: { Data: "Hi", Charset: "UTF-8" } },
          Headers: [{ Name: "List-Unsubscribe", Value: "<mailto:unsubscribe@example.com>" }],
        },
      },
      EmailTags: [{ Name: "campaign", Value: "welcome" }],
    });
  });

  it("omits the parts a message does not have", async () => {
    ses.on(SendEmailCommand).resolves({ MessageId: "id" });

    await provider.send({ from: { address: "hello@example.com" }, to: [{ address: "ada@example.org" }], subject: "Hi", text: "Hi" });
    const input = ses.commandCalls(SendEmailCommand)[0]!.args[0].input;

    assert.equal(input.Content?.Simple?.Body?.Html, undefined);
    assert.equal(input.Content?.Simple?.Headers, undefined);
    assert.equal(input.EmailTags, undefined);
  });

  it("treats sender and account problems as permanent rejections", async () => {
    const rejections: [string, Error][] = [
      ["MessageRejected", sesError(MessageRejected)],
      ["MailFromDomainNotVerifiedException", sesError(MailFromDomainNotVerifiedException)],
      ["AccountSuspendedException", sesError(AccountSuspendedException)],
      ["SendingPausedException", sesError(SendingPausedException)],
    ];
    for (const [name, rejection] of rejections) {
      ses.on(SendEmailCommand).rejects(rejection);

      await assert.rejects(provider.send(message), (error: unknown) => {
        return (
          error instanceof ProviderError &&
          error.code === "ATL_PROVIDER_REJECTED" &&
          error.retryable === false &&
          error.message.includes(name)
        );
      });
    }
  });

  it("treats quota limits as throttling", async () => {
    ses.on(SendEmailCommand).rejects(sesError(LimitExceededException));

    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.code === "ATL_PROVIDER_THROTTLED" && error.retryable;
    });
  });

  it("treats a timeout or a missing message id as an unknown outcome", async () => {
    ses.on(SendEmailCommand).rejects(Object.assign(new Error("timed out"), { name: "TimeoutError", code: "ETIMEDOUT" }));
    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.code === "ATL_PROVIDER_TIMEOUT" && !error.retryable;
    });

    ses.on(SendEmailCommand).resolves({});
    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.code === "ATL_PROVIDER_TIMEOUT" && error.cause === undefined;
    });
  });
});

describe("formatAddress", () => {
  it("quotes ASCII names, encodes non-ASCII names, and leaves bare addresses alone", () => {
    assert.equal(formatAddress({ address: "a@example.com" }), "a@example.com");
    assert.equal(formatAddress({ name: 'Acme "Best", Inc', address: "a@example.com" }), '"Acme \\"Best\\", Inc" <a@example.com>');
    assert.equal(formatAddress({ name: "Müller GmbH", address: "info@example.de" }), "=?UTF-8?Q?M=C3=BCller_GmbH?= <info@example.de>");
    assert.ok(/^[\x20-\x7e]*$/.test(formatAddress({ name: "名前 テスト", address: "a@example.jp" })));
    assert.ok(!formatAddress({ name: "x\r\nBcc: v@example.org ü", address: "a@example.com" }).includes("\n"));
  });

  it("refuses addresses that could break the header", () => {
    for (const address of ["a@example.com\r\nBcc: v@example.org", "a b@example.com", "a@example.com>", '"a"@example.com']) {
      assert.throws(() => formatAddress({ address }), ProviderError, JSON.stringify(address));
    }
  });
});

describe("provider error reasons", () => {
  it("keeps the provider error name and nothing else", async () => {
    const { toReason, ProviderRejectedError } = await import("../src/index.ts");

    assert.equal(toReason("MessageRejected"), "MessageRejected");
    assert.equal(toReason("Email address is not verified: ada@example.org"), "Unknown");
    assert.equal(toReason("a".repeat(65)), "Unknown");
    assert.equal(toReason(undefined), "Unknown");
    assert.equal(new ProviderRejectedError("MessageRejected").summary, "ATL_PROVIDER_REJECTED: MessageRejected");
    assert.equal(new ProviderRejectedError("bad <ada@example.org>").summary, "ATL_PROVIDER_REJECTED: Unknown");
  });

  it("maps SES failures with their reason", async () => {
    ses.on(SendEmailCommand).rejects(sesError(MessageRejected));
    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.summary === "ATL_PROVIDER_REJECTED: MessageRejected";
    });

    ses.on(SendEmailCommand).rejects(sesError(LimitExceededException));
    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.summary === "ATL_PROVIDER_THROTTLED: LimitExceededException";
    });

    ses.on(SendEmailCommand).rejects(Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }));
    await assert.rejects(provider.send(message), (error: unknown) => {
      return error instanceof ProviderError && error.summary === "ATL_PROVIDER_UNAVAILABLE: ENOTFOUND";
    });
  });
});
