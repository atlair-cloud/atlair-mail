import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { mockClient } from "aws-sdk-client-mock";
import {
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  GetAccountCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import {
  AuthorizationErrorException,
  ConfirmSubscriptionCommand,
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
import { schema } from "@atlair-mail/db";
import { createSnsTestSigner } from "@atlair-mail/providers/testing";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const input = {
  type: "ses",
  region: "ap-south-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};
const topicArn = "arn:aws:sns:ap-south-1:123456789012:atlair-mail-events";

const ses = mockClient(SESv2Client);
const sns = mockClient(SNSClient);
const sign = createSnsTestSigner();

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(() => {
  ses.reset();
  sns.reset();
  ses.on(GetAccountCommand).resolves({ SendingEnabled: true, ProductionAccessEnabled: true });
  ses.on(CreateConfigurationSetCommand).resolves({});
  ses.on(CreateConfigurationSetEventDestinationCommand).resolves({});
  sns.on(CreateTopicCommand).resolves({ TopicArn: topicArn });
  sns.on(SetTopicAttributesCommand).resolves({});
  sns.on(SubscribeCommand).resolves({ SubscriptionArn: "pending confirmation" });
  sns.on(ConfirmSubscriptionCommand).resolves({ SubscriptionArn: `${topicArn}:sub` });
});

async function connectedKey(app: TestApp) {
  const key = await createTestKey(app);
  const saved = await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(key.token), payload: input });
  assert.equal(saved.statusCode, 200);
  return { ...key, connectionId: saved.json().id as string };
}

const setUp = (app: TestApp, token: string, payload?: object) =>
  app.inject({ method: "POST", url: "/v1/provider/events", headers: auth(token), ...(payload && { payload }) });

const confirm = (app: TestApp, connectionId: string) =>
  app.inject({
    method: "POST",
    url: `/webhooks/provider-events/${connectionId}`,
    headers: { "content-type": "text/plain; charset=UTF-8" },
    payload: JSON.stringify(
      sign({
        Type: "SubscriptionConfirmation",
        TopicArn: topicArn,
        Token: "token-1",
        Message: "You have chosen to subscribe",
        SubscribeURL: "https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription",
      }),
    ),
  });

describe("POST /v1/provider/events", { skip: !hasDatabase }, () => {
  it("connecting a provider leaves events off", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const saved = await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(token), payload: input });

    assert.deepEqual(saved.json().events, { url: null, status: "disabled", confirmedAt: null });
    assert.equal(sns.commandCalls(SubscribeCommand).length, 0);
  });

  it("registers the URL, subscribes this connection's path and waits for confirmation", async () => {
    const app = await buildTestApp();
    const { token, organizationId, connectionId } = await connectedKey(app);

    const res = await setUp(app, token, { url: "https://Mail.Example.com/" });
    const [row] = await app.db
      .select()
      .from(schema.providerConnections)
      .where(eq(schema.providerConnections.organizationId, organizationId));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().events, {
      url: "https://mail.example.com",
      status: "pending_confirmation",
      confirmedAt: null,
    });
    assert.ok(!res.body.includes(topicArn));
    assert.equal(
      sns.commandCalls(SubscribeCommand)[0]!.args[0].input.Endpoint,
      `https://mail.example.com/webhooks/provider-events/${connectionId}`,
    );
    assert.equal(row!.settings.eventTopicArn, topicArn);
  });

  it("is confirmed once the signed confirmation arrives, and pending again for a new URL", async () => {
    const app = await buildTestApp();
    const { token, connectionId } = await connectedKey(app);
    await setUp(app, token, { url: "https://a.example.com" });

    const confirmation = await confirm(app, connectionId);
    const confirmed = (await app.inject({ method: "GET", url: "/v1/provider", headers: auth(token) })).json();
    const rerun = (await setUp(app, token, { url: "https://a.example.com/" })).json();
    const moved = (await setUp(app, token, { url: "https://b.example.com" })).json();

    assert.equal(confirmation.statusCode, 204);
    assert.equal(confirmed.events.status, "confirmed");
    assert.ok(confirmed.events.confirmedAt);
    assert.equal(rerun.events.status, "confirmed");
    assert.equal(rerun.events.url, "https://a.example.com");
    assert.deepEqual(moved.events, { url: "https://b.example.com", status: "pending_confirmation", confirmedAt: null });
    assert.equal(
      sns.commandCalls(SubscribeCommand).at(-1)!.args[0].input.Endpoint,
      `https://b.example.com/webhooks/provider-events/${connectionId}`,
    );
  });

  it("replacing the connection turns events off", async () => {
    const app = await buildTestApp();
    const { token } = await connectedKey(app);
    await setUp(app, token, { url: "https://a.example.com" });

    const replaced = await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(token), payload: input });

    assert.equal(replaced.json().events.status, "disabled");
  });

  it("rejects URLs that are not a public https address", async () => {
    const app = await buildTestApp();
    const { token } = await connectedKey(app);

    for (const url of [
      "http://mail.example.com",
      "https://localhost:8080",
      "https://169.254.169.254",
      "https://10.0.0.5",
      "https://db.internal",
      "https://user:pass@mail.example.com",
      "https://mail.example.com/?next=x",
      "https://mail.example.com/#x",
      "https://mail.example.com\r\nX-Injected: 1",
    ]) {
      const res = await setUp(app, token, { url });
      assert.equal(res.statusCode, 400, url);
      assert.ok(["FST_ERR_VALIDATION", "ATL_INVALID_EVENTS_URL"].includes(res.json().code), url);
    }
    assert.equal(sns.commandCalls(SubscribeCommand).length, 0);

    const extra = await setUp(app, token, { url: "https://mail.example.com", topicArn: "arn:aws:sns:x:1:attacker" });
    assert.equal(extra.statusCode, 200);
    assert.equal(sns.commandCalls(SetTopicAttributesCommand)[0]!.args[0].input.TopicArn, topicArn);
  });

  it("requires a URL, and explains a missing connection or permission", async () => {
    const app = await buildTestApp();
    const { token } = await connectedKey(app);
    const unconnected = await createTestKey(app);
    const sending = await createTestKey(app, { permission: "sending_access" });

    const noUrl = await setUp(app, token);
    const noConnection = await setUp(app, unconnected.token, { url: "https://mail.example.com" });
    const forbidden = await setUp(app, sending.token, { url: "https://mail.example.com" });
    sns.on(CreateTopicCommand).rejects(new AuthorizationErrorException({ message: "denied", $metadata: {} }));
    const denied = await setUp(app, token, { url: "https://mail.example.com" });
    const after = (await app.inject({ method: "GET", url: "/v1/provider", headers: auth(token) })).json();

    assert.equal(noUrl.statusCode, 400);
    assert.equal(noUrl.json().code, "FST_ERR_VALIDATION");
    assert.equal(noConnection.statusCode, 409);
    assert.equal(noConnection.json().code, "ATL_PROVIDER_NOT_CONNECTED");
    assert.equal(forbidden.statusCode, 403);
    assert.equal(denied.statusCode, 422);
    assert.equal(denied.json().code, "ATL_PROVIDER_REJECTED");
    assert.equal(after.events.status, "disabled");
  });
});
