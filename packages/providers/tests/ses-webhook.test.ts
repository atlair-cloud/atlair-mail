import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProviderEventRejectedError, readProviderWebhook, type SesSettings } from "../src/index.ts";
import { readSesWebhook } from "../src/ses/ses-webhook.ts";
import { createSnsTestSigner } from "../src/testing.ts";

const topicArn = "arn:aws:sns:ap-south-1:123456789012:atlair-mail-events";
const settings: SesSettings = { region: "ap-south-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", eventTopicArn: topicArn };

const sign = createSnsTestSigner();

const signed = (fields: Record<string, string> & { Type: string }) => sign({ TopicArn: topicArn, ...fields });

const sesDelivery = (overrides: object = {}) =>
  JSON.stringify({
    eventType: "Delivery",
    mail: {
      timestamp: "2026-10-09T10:00:00.000Z",
      messageId: "010901a11ca2cbbd-0000",
      sendingAccountId: "123456789012",
      destination: ["ada@example.org"],
      tags: { atlair_email_id: ["01a11ca2-c72a-701c-940c-0fa9badc0f5a"] },
    },
    delivery: { timestamp: "2026-10-09T10:00:02.000Z", recipients: ["ada@example.org"], smtpResponse: "250 OK" },
    ...overrides,
  });

const read = (body: unknown, source: SesSettings = settings) => readProviderWebhook({ type: "ses", settings: source }, body);

const rejectedWith = (reason: string) => (error: unknown) => {
  assert.ok(error instanceof ProviderEventRejectedError);
  assert.equal(error.reason, reason);
  return true;
};

describe("reading SES events delivered by SNS", () => {
  it("returns the event from a signed notification", async () => {
    const result = await read(signed({ Type: "Notification", Message: sesDelivery() }));

    assert.equal(result.kind, "event");
    assert.equal(result.kind === "event" && result.event.type, "delivered");
    assert.equal(result.kind === "event" && result.event.emailId, "01a11ca2-c72a-701c-940c-0fa9badc0f5a");
  });

  it("returns the token from a signed subscription confirmation without visiting its URL", async () => {
    const result = await read(
      signed({
        Type: "SubscriptionConfirmation",
        Token: "token-1",
        Message: "You have chosen to subscribe",
        SubscribeURL: "https://169.254.169.254/latest/meta-data",
      }),
    );

    assert.deepEqual(result, { kind: "confirm", token: "token-1" });
  });

  it("rejects a tampered message", async () => {
    const message = signed({ Type: "Notification", Message: sesDelivery() });

    await assert.rejects(read({ ...message, Message: sesDelivery({ eventType: "Bounce" }) }), rejectedWith("InvalidSignature"));
    await assert.rejects(read({ ...message, Signature: "AAAA" }), rejectedWith("InvalidSignature"));
  });

  it("rejects certificates that are not served by SNS", async () => {
    const message = signed({ Type: "Notification", Message: sesDelivery() });

    await assert.rejects(
      read({ ...message, SigningCertURL: "https://attacker.example/SimpleNotificationService-x.pem" }),
      rejectedWith("InvalidSignature"),
    );
    await assert.rejects(read({ ...message, SignatureVersion: "3" }), rejectedWith("InvalidSignature"));
  });

  it("rejects a validly signed message from another topic before checking the signature", async () => {
    let verified = false;
    const foreign = signed({
      Type: "Notification",
      Message: sesDelivery(),
      TopicArn: "arn:aws:sns:ap-south-1:999999999999:atlair-mail-events",
    });

    await assert.rejects(
      readSesWebhook(settings, foreign, async () => {
        verified = true;
      }),
      rejectedWith("UnknownTopic"),
    );
    await assert.rejects(read(foreign, { ...settings, eventTopicArn: undefined }), rejectedWith("UnknownTopic"));
    assert.equal(verified, false);
  });

  it("rejects an event sent from a different account than the topic's", async () => {
    const message = sesDelivery({
      mail: {
        timestamp: "2026-10-09T10:00:00.000Z",
        messageId: "m",
        sendingAccountId: "999999999999",
        destination: ["a@example.org"],
      },
    });

    await assert.rejects(read(signed({ Type: "Notification", Message: message })), rejectedWith("AccountMismatch"));
  });

  it("ignores signed messages it has no use for", async () => {
    assert.deepEqual(await read(signed({ Type: "Notification", Message: "not json" })), { kind: "ignored" });
    assert.deepEqual(
      await read(signed({ Type: "Notification", Message: JSON.stringify({ eventType: "Rendering Failure" }) })),
      { kind: "ignored" },
    );
  });

  it("rejects bodies that are not SNS messages", async () => {
    await assert.rejects(read(null), rejectedWith("MalformedMessage"));
    await assert.rejects(read([topicArn]), rejectedWith("MalformedMessage"));
    await assert.rejects(read({ TopicArn: topicArn, Type: "Notification" }), rejectedWith("InvalidSignature"));
  });
});
