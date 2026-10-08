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

const provider = createProvider({
  type: "ses",
  settings: { region: "eu-west-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" },
  secrets: { secretAccessKey: "secret" },
}, { retry: false });
const ses = mockClient(SESv2Client);

const message = {
  from: "Acme <hello@example.com>",
  to: ["ada@example.org"],
  cc: ["grace@example.org"],
  bcc: ["audit@example.com"],
  replyTo: ["support@example.com"],
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
      FromEmailAddress: "Acme <hello@example.com>",
      Destination: {
        ToAddresses: ["ada@example.org"],
        CcAddresses: ["grace@example.org"],
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

    await provider.send({ from: "hello@example.com", to: ["ada@example.org"], subject: "Hi", text: "Hi" });
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
