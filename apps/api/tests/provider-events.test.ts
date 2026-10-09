import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { mockClient } from "aws-sdk-client-mock";
import { ConfirmSubscriptionCommand, SNSClient } from "@aws-sdk/client-sns";
import { schema } from "@atlair-mail/db";
import { createSnsTestSigner } from "@atlair-mail/providers/testing";
import { buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

const sns = mockClient(SNSClient);
const sign = createSnsTestSigner();
const account = "123456789012";

beforeEach(() => sns.reset());

async function connected(app: TestApp) {
  const key = await createTestKey(app);
  const topicArn = `arn:aws:sns:ap-south-1:${account}:atlair-mail-events-${uuidv7()}`;
  const { ciphertext, keyVersion } = await app.credentialsCipher.encrypt(
    JSON.stringify({ secretAccessKey: "secret" }),
    key.organizationId,
  );
  const [connection] = await app.db
    .insert(schema.providerConnections)
    .values({
      organizationId: key.organizationId,
      provider: "ses",
      settings: { region: "ap-south-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", eventTopicArn: topicArn },
      credentialsEncrypted: ciphertext,
      encryptionKeyVersion: keyVersion,
    })
    .returning();
  const [domain] = await app.db
    .insert(schema.domains)
    .values({ organizationId: key.organizationId, name: `${uuidv7()}.example.com`, status: "verified" })
    .returning();
  const [email] = await app.db
    .insert(schema.emails)
    .values({
      organizationId: key.organizationId,
      domainId: domain!.id,
      fromAddress: `hello@${domain!.name}`,
      toAddresses: ["ada@example.org"],
      subject: "Welcome",
      textBody: "Hi",
      status: "sent",
      providerMessageId: uuidv7(),
    })
    .returning();
  return { ...key, topicArn, connection: connection!, email: email! };
}

const delivery = (providerMessageId: string, emailId?: string) =>
  JSON.stringify({
    eventType: "Delivery",
    mail: {
      timestamp: "2026-10-09T10:00:00.000Z",
      messageId: providerMessageId,
      sendingAccountId: account,
      destination: ["ada@example.org"],
      tags: emailId ? { atlair_email_id: [emailId] } : {},
    },
    delivery: { timestamp: "2026-10-09T10:00:02.000Z", recipients: ["ada@example.org"], smtpResponse: "250 OK" },
  });

const post = (app: TestApp, connectionId: string, body: unknown, contentType = "text/plain; charset=UTF-8") =>
  app.inject({
    method: "POST",
    url: `/webhooks/provider-events/${connectionId}`,
    headers: { "content-type": contentType, "x-amz-sns-message-type": "Notification" },
    payload: typeof body === "string" ? body : JSON.stringify(body),
  });

const statusOf = async (app: TestApp, id: string) =>
  (await app.db.select().from(schema.emails).where(eq(schema.emails.id, id)))[0]!.status;

describe("POST /webhooks/provider-events/:connectionId", { skip: !hasDatabase }, () => {
  it("applies a signed event without an API key and ignores the repeat", async () => {
    const app = await buildTestApp();
    const { topicArn, connection, email } = await connected(app);
    const message = sign({ Type: "Notification", TopicArn: topicArn, Message: delivery(email.providerMessageId!) });

    const first = await post(app, connection.id, message);
    const repeat = await post(app, connection.id, message, "application/json");

    assert.equal(first.statusCode, 204);
    assert.equal(repeat.statusCode, 204);
    assert.equal(await statusOf(app, email.id), "delivered");
    assert.equal((await app.services.emailEvents.list(email.organizationId, email.id))?.length, 1);
  });

  it("confirms the subscription through the provider API, never the URL in the message", async () => {
    const app = await buildTestApp();
    const { topicArn, connection } = await connected(app);
    sns.on(ConfirmSubscriptionCommand).resolves({ SubscriptionArn: `${topicArn}:sub` });

    const res = await post(
      app,
      connection.id,
      sign({
        Type: "SubscriptionConfirmation",
        TopicArn: topicArn,
        Token: "token-1",
        Message: "You have chosen to subscribe",
        SubscribeURL: "http://169.254.169.254/latest/meta-data/",
      }),
    );

    assert.equal(res.statusCode, 204);
    assert.deepEqual(sns.commandCalls(ConfirmSubscriptionCommand)[0]!.args[0].input, {
      TopicArn: topicArn,
      Token: "token-1",
      AuthenticateOnUnsubscribe: "true",
    });
  });

  it("rejects tampered, unsigned and foreign-topic messages with 403", async () => {
    const app = await buildTestApp();
    const { topicArn, connection, email } = await connected(app);
    const other = await connected(app);
    const message = sign({ Type: "Notification", TopicArn: topicArn, Message: delivery(email.providerMessageId!) });

    const tampered = await post(app, connection.id, { ...message, Message: delivery(uuidv7()) });
    const unsigned = await post(app, connection.id, { Type: "Notification", TopicArn: topicArn, Message: "{}" });
    const foreignTopic = await post(app, other.connection.id, message);

    for (const res of [tampered, unsigned, foreignTopic]) {
      assert.equal(res.statusCode, 403);
      assert.equal(res.json().code, "ATL_PROVIDER_EVENT_UNVERIFIED");
    }
    assert.equal(await statusOf(app, email.id), "sent");
  });

  it("never applies an event to another organization's email", async () => {
    const app = await buildTestApp();
    const victim = await connected(app);
    const attacker = await connected(app);

    const res = await post(
      app,
      attacker.connection.id,
      sign({
        Type: "Notification",
        TopicArn: attacker.topicArn,
        Message: delivery(victim.email.providerMessageId!, victim.email.id),
      }),
    );

    assert.equal(res.statusCode, 204);
    assert.equal(await statusOf(app, victim.email.id), "sent");
  });

  it("returns 404 for an unknown connection and 400 for bad ids or bad JSON", async () => {
    const app = await buildTestApp();
    const { connection } = await connected(app);

    assert.equal((await post(app, uuidv7(), { Type: "Notification" })).statusCode, 404);
    assert.equal((await post(app, "not-a-uuid", { Type: "Notification" })).statusCode, 400);
    assert.equal((await post(app, connection.id, "{not json")).statusCode, 400);
    assert.equal((await post(app, connection.id, '{"__proto__":{"x":1}}')).statusCode, 400);
  });

  it("limits the body to 256 KB", async () => {
    const app = await buildTestApp();
    const { connection } = await connected(app);

    const res = await post(app, connection.id, { Type: "Notification", Message: "x".repeat(300 * 1024) });

    assert.equal(res.statusCode, 413);
  });

  it("is documented as public", async () => {
    const app = await buildTestApp();

    const spec = (await app.inject({ method: "GET", url: "/docs/openapi.json" })).json();
    const operation = spec.paths["/webhooks/provider-events/{connectionId}"].post;

    assert.deepEqual(operation.security, []);
  });
});
