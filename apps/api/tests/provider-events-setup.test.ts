import { randomInt } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { mockClient } from "aws-sdk-client-mock";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
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
  ListSubscriptionsByTopicCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  GetQueueUrlCommand,
  QueueDoesNotExist,
  SQSClient,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";
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

const disabledEvents = {
  mode: null,
  url: null,
  status: "disabled",
  confirmedAt: null,
  lastReceivedAt: null,
  lastError: null,
  backlog: null,
  deadLetters: null,
};

const ses = mockClient(SESv2Client);
const sts = mockClient(STSClient);
const awsAccountId = () => String(randomInt(100_000_000_000, 1_000_000_000_000));
const sns = mockClient(SNSClient);
const sqs = mockClient(SQSClient);
const sign = createSnsTestSigner();

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

beforeEach(() => {
  ses.reset();
  sts.reset();
  sts.on(GetCallerIdentityCommand).resolves({ Account: awsAccountId() });
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
  const saved = await app.inject({ method: "PUT", url: "/service/web/provider", headers: auth(key.token), payload: input });
  assert.equal(saved.statusCode, 200);
  return { ...key, connectionId: saved.json().id as string };
}

const setUp = (app: TestApp, token: string, payload?: object) =>
  app.inject({ method: "POST", url: "/service/web/provider/events", headers: auth(token), ...(payload && { payload }) });

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

describe("POST /service/web/provider/events", { skip: !hasDatabase }, () => {
  it("connecting a provider leaves events off", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const saved = await app.inject({ method: "PUT", url: "/service/web/provider", headers: auth(token), payload: input });

    assert.deepEqual(saved.json().events, disabledEvents);
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
      ...disabledEvents,
      mode: "push",
      url: "https://mail.example.com",
      status: "pending_confirmation",
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
    const confirmed = (await app.inject({ method: "GET", url: "/service/web/provider", headers: auth(token) })).json();
    const rerun = (await setUp(app, token, { url: "https://a.example.com/" })).json();
    const moved = (await setUp(app, token, { url: "https://b.example.com" })).json();

    assert.equal(confirmation.statusCode, 204);
    assert.equal(confirmed.events.status, "confirmed");
    assert.ok(confirmed.events.confirmedAt);
    assert.equal(rerun.events.status, "confirmed");
    assert.equal(rerun.events.url, "https://a.example.com");
    assert.deepEqual(moved.events, {
      ...disabledEvents,
      mode: "push",
      url: "https://b.example.com",
      status: "pending_confirmation",
    });
    assert.equal(
      sns.commandCalls(SubscribeCommand).at(-1)!.args[0].input.Endpoint,
      `https://b.example.com/webhooks/provider-events/${connectionId}`,
    );
  });

  it("replacing the connection turns events off", async () => {
    const app = await buildTestApp();
    const { token } = await connectedKey(app);
    await setUp(app, token, { url: "https://a.example.com" });

    const replaced = await app.inject({ method: "PUT", url: "/service/web/provider", headers: auth(token), payload: input });

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
    const after = (await app.inject({ method: "GET", url: "/service/web/provider", headers: auth(token) })).json();

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

describe("POST /service/web/provider/events in pull mode", { skip: !hasDatabase }, () => {
  const account = "123456789012";
  const queueFor = (connectionId: string) => {
    const name = `atlair-mail-events-${connectionId}`;
    return {
      arn: `arn:aws:sqs:ap-south-1:${account}:${name}`,
      url: `https://sqs.ap-south-1.amazonaws.com/${account}/${name}`,
    };
  };

  beforeEach(() => {
    sqs.reset();
    sqs.on(GetQueueUrlCommand).rejects(new QueueDoesNotExist({ message: "missing", $metadata: {} }));
    sqs.on(CreateQueueCommand).callsFake((command: { QueueName: string }) => ({
      QueueUrl: `https://sqs.ap-south-1.amazonaws.com/${account}/${command.QueueName}`,
    }));
    sqs.on(StartMessageMoveTaskCommand).resolves({ TaskHandle: "task" });
    sns.on(SubscribeCommand, { Protocol: "sqs" }).resolves({ SubscriptionArn: `${topicArn}:sqs` });
    sns.on(UnsubscribeCommand).resolves({});
  });

  const listing = (connectionId: string) =>
    sns.on(ListSubscriptionsByTopicCommand).resolves({
      Subscriptions: [
        {
          SubscriptionArn: `${topicArn}:https`,
          Protocol: "https",
          Endpoint: `https://a.example.com/webhooks/provider-events/${connectionId}`,
        },
        { SubscriptionArn: `${topicArn}:sqs`, Protocol: "sqs", Endpoint: queueFor(connectionId).arn },
      ],
    });

  const unsubscribed = () => sns.commandCalls(UnsubscribeCommand).map((call) => call.args[0].input.SubscriptionArn);

  it("sets up the queue, is confirmed at once, removes the push subscription and never shows the queue address", async () => {
    const app = await buildTestApp();
    const { token, organizationId, connectionId } = await connectedKey(app);
    await setUp(app, token, { url: "https://a.example.com" });
    listing(connectionId);

    const res = await setUp(app, token, { mode: "pull" });
    const [row] = await app.db
      .select()
      .from(schema.providerConnections)
      .where(eq(schema.providerConnections.organizationId, organizationId));

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().events.mode, "pull");
    assert.equal(res.json().events.url, null);
    assert.equal(res.json().events.status, "confirmed");
    assert.ok(res.json().events.confirmedAt);
    assert.ok(!res.body.includes("sqs.") && !res.body.includes(account));
    assert.equal(row!.settings.eventQueueUrl, queueFor(connectionId).url);
    assert.ok(row!.eventsPollAfter);
    assert.deepEqual(unsubscribed(), [`${topicArn}:https`]);
  });

  it("switching back to push keeps the queue subscription until the new one is confirmed", async () => {
    const app = await buildTestApp();
    const { token, connectionId } = await connectedKey(app);
    listing(connectionId);
    await setUp(app, token, { mode: "pull" });
    sns.on(UnsubscribeCommand).resolves({});
    sns.resetHistory();

    const switched = (await setUp(app, token, { url: "https://a.example.com" })).json();
    const beforeConfirmation = unsubscribed();
    await confirm(app, connectionId);

    assert.equal(switched.events.mode, "push");
    assert.equal(switched.events.status, "pending_confirmation");
    assert.deepEqual(beforeConfirmation, []);
    assert.deepEqual(unsubscribed(), [`${topicArn}:sqs`]);
  });

  it("shows when the worker cannot read the queue, with the dead-letter count", async () => {
    const app = await buildTestApp();
    const { token, connectionId } = await connectedKey(app);
    listing(connectionId);
    await setUp(app, token, { mode: "pull" });
    await app.db
      .update(schema.providerConnections)
      .set({ eventsLastError: "ATL_PROVIDER_REJECTED: AccessDenied", eventsDeadLetters: 3, eventsBacklog: 7 })
      .where(eq(schema.providerConnections.id, connectionId));

    const events = (await app.inject({ method: "GET", url: "/service/web/provider", headers: auth(token) })).json().events;

    assert.equal(events.status, "failing");
    assert.equal(events.lastError, "ATL_PROVIDER_REJECTED: AccessDenied");
    assert.equal(events.deadLetters, 3);
    assert.equal(events.backlog, 7);
  });

  it("checks the mode and url together", async () => {
    const app = await buildTestApp();
    const { token } = await connectedKey(app);

    const pullWithUrl = await setUp(app, token, { mode: "pull", url: "https://a.example.com" });
    const pushWithoutUrl = await setUp(app, token, { mode: "push" });
    const unknownMode = await setUp(app, token, { mode: "carrier-pigeon" });

    assert.equal(pullWithUrl.statusCode, 400);
    assert.equal(pullWithUrl.json().code, "ATL_INVALID_EVENTS_SETUP");
    assert.equal(pushWithoutUrl.json().code, "ATL_INVALID_EVENTS_SETUP");
    assert.equal(unknownMode.statusCode, 400);
    assert.equal(sqs.calls().length, 0);
  });

  it("redrives the dead-letter queue only in pull mode and only with a full_access key", async () => {
    const app = await buildTestApp();
    const { token, connectionId, organizationId } = await connectedKey(app);
    const sending = await createTestKey(app, { permission: "sending_access" });
    const redrive = (key: string) =>
      app.inject({ method: "POST", url: "/service/web/provider/events/redrive", headers: auth(key) });

    const beforePull = await redrive(token);
    listing(connectionId);
    await setUp(app, token, { mode: "pull" });
    const started = await redrive(token);
    const forbidden = await redrive(sending.token);

    assert.equal(beforePull.statusCode, 409);
    assert.equal(beforePull.json().code, "ATL_EVENT_QUEUE_NOT_CONFIGURED");
    assert.equal(started.statusCode, 202);
    assert.deepEqual(started.json(), { status: "started" });
    assert.deepEqual(sqs.commandCalls(StartMessageMoveTaskCommand).map((call) => call.args[0].input), [
      { SourceArn: `${queueFor(connectionId).arn}-dlq` },
    ]);
    assert.equal(forbidden.statusCode, 403);
    assert.ok(organizationId);
  });
});
