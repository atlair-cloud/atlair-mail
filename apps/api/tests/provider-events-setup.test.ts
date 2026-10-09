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
  CreateTopicCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
import { schema } from "@atlair-mail/db";
import { loadEnv } from "../src/env.ts";
import { auth, buildTestApp, createTestKey, hasDatabase, TEST_CREDENTIALS_ENCRYPTION_KEYS } from "./helpers.ts";

const input = {
  type: "ses",
  region: "ap-south-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};
const topicArn = "arn:aws:sns:ap-south-1:123456789012:atlair-mail-events";
const publicUrl = "https://mail.example.com/";

const ses = mockClient(SESv2Client);
const sns = mockClient(SNSClient);

beforeEach(() => {
  ses.reset();
  sns.reset();
  ses.on(GetAccountCommand).resolves({ SendingEnabled: true, ProductionAccessEnabled: true });
  ses.on(CreateConfigurationSetCommand).resolves({});
  ses.on(CreateConfigurationSetEventDestinationCommand).resolves({});
  sns.on(CreateTopicCommand).resolves({ TopicArn: topicArn });
  sns.on(SetTopicAttributesCommand).resolves({});
  sns.on(SubscribeCommand).resolves({ SubscriptionArn: "pending confirmation" });
});

describe("delivery event setup", { skip: !hasDatabase }, () => {
  it("sets up events when a provider is connected and subscribes this connection's URL", async () => {
    const app = await buildTestApp({ PUBLIC_URL: publicUrl });
    const { token, organizationId } = await createTestKey(app);

    const res = await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(token), payload: input });
    const [row] = await app.db
      .select()
      .from(schema.providerConnections)
      .where(eq(schema.providerConnections.organizationId, organizationId));

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().eventsEnabled, true);
    assert.equal(res.json().eventsError, null);
    assert.ok(!res.body.includes(topicArn));
    assert.deepEqual(row!.settings, {
      region: "ap-south-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      eventTopicArn: topicArn,
      configurationSetName: "atlair-mail",
    });
    assert.equal(
      sns.commandCalls(SubscribeCommand)[0]!.args[0].input.Endpoint,
      `https://mail.example.com/webhooks/provider-events/${row!.id}`,
    );
  });

  it("still saves the connection when events cannot be set up, and says why", async () => {
    sns.on(CreateTopicCommand).rejects(new AuthorizationErrorException({ message: "denied", $metadata: {} }));
    const withUrl = await buildTestApp({ PUBLIC_URL: publicUrl });
    const withoutUrl = await buildTestApp();
    const first = await createTestKey(withUrl);
    const second = await createTestKey(withoutUrl);

    const denied = await withUrl.inject({ method: "PUT", url: "/v1/provider", headers: auth(first.token), payload: input });
    const noUrl = await withoutUrl.inject({
      method: "PUT",
      url: "/v1/provider",
      headers: auth(second.token),
      payload: input,
    });

    assert.equal(denied.statusCode, 200);
    assert.equal(denied.json().eventsEnabled, false);
    assert.equal(denied.json().eventsError, "ATL_PROVIDER_REJECTED: AuthorizationErrorException");
    assert.equal(noUrl.statusCode, 200);
    assert.equal(noUrl.json().eventsError, "ATL_PUBLIC_URL_NOT_SET");
  });

  it("POST /v1/provider/events sets up or repairs events for an existing connection", async () => {
    const app = await buildTestApp({ PUBLIC_URL: publicUrl });
    const { token } = await createTestKey(app);
    sns.on(CreateTopicCommand).rejects(new AuthorizationErrorException({ message: "denied", $metadata: {} }));
    const saved = await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(token), payload: input });
    sns.on(CreateTopicCommand).resolves({ TopicArn: topicArn });

    const repaired = await app.inject({ method: "POST", url: "/v1/provider/events", headers: auth(token) });
    const got = await app.inject({ method: "GET", url: "/v1/provider", headers: auth(token) });

    assert.equal(saved.json().eventsEnabled, false);
    assert.equal(repaired.statusCode, 200);
    assert.equal(repaired.json().eventsEnabled, true);
    assert.equal(got.json().eventsEnabled, true);
  });

  it("POST /v1/provider/events explains what is missing", async () => {
    const app = await buildTestApp();
    const withUrl = await buildTestApp({ PUBLIC_URL: publicUrl });
    const connected = await createTestKey(app);
    const unconnected = await createTestKey(withUrl);
    const sending = await createTestKey(app, { permission: "sending_access" });
    await app.inject({ method: "PUT", url: "/v1/provider", headers: auth(connected.token), payload: input });

    const noUrl = await app.inject({ method: "POST", url: "/v1/provider/events", headers: auth(connected.token) });
    const noConnection = await withUrl.inject({
      method: "POST",
      url: "/v1/provider/events",
      headers: auth(unconnected.token),
    });
    const forbidden = await app.inject({ method: "POST", url: "/v1/provider/events", headers: auth(sending.token) });

    assert.equal(noUrl.statusCode, 409);
    assert.equal(noUrl.json().code, "ATL_PUBLIC_URL_NOT_SET");
    assert.equal(noConnection.statusCode, 409);
    assert.equal(noConnection.json().code, "ATL_PROVIDER_NOT_CONNECTED");
    assert.equal(forbidden.statusCode, 403);
  });

  it("accepts only an https PUBLIC_URL without a query or fragment", () => {
    const env = (PUBLIC_URL: string) => () =>
      loadEnv({ PUBLIC_URL, CREDENTIALS_ENCRYPTION_KEYS: TEST_CREDENTIALS_ENCRYPTION_KEYS });

    assert.doesNotThrow(env(""));
    assert.doesNotThrow(env("https://mail.example.com"));
    assert.doesNotThrow(env("https://example.com/mail/"));
    assert.throws(env("http://mail.example.com"));
    assert.throws(env("https://mail.example.com/?a=1"));
    assert.throws(env("https://mail.example.com/#x"));
    assert.throws(env("mail.example.com"));
  });
});
