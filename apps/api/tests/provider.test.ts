import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { mockClient } from "aws-sdk-client-mock";
import { GetAccountCommand, SESv2Client, SESv2ServiceException } from "@aws-sdk/client-sesv2";
import { schema } from "@atlair-mail/db";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/v1/provider";
const secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const input = { type: "ses", region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey };

const ses = mockClient(SESv2Client);

const awsError = (name: string, fault: "client" | "server") =>
  new SESv2ServiceException({ name, $fault: fault, $metadata: {}, message: name });

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

const storedConnection = async (app: TestApp, organizationId: string) =>
  (
    await app.db
      .select()
      .from(schema.providerConnections)
      .where(eq(schema.providerConnections.organizationId, organizationId))
  )[0];

beforeEach(() => {
  ses.reset();
  ses.on(GetAccountCommand).resolves({
    SendingEnabled: true,
    ProductionAccessEnabled: false,
    SendQuota: { Max24HourSend: 200, MaxSendRate: 1, SentLast24Hours: 0 },
  });
});

describe("/v1/provider", { skip: !hasDatabase }, () => {
  it("checks the credentials with the provider and stores only ciphertext", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);

    const res = await app.inject({ method: "PUT", url, headers: auth(token), payload: input });
    const row = await storedConnection(app, organizationId);

    assert.equal(res.statusCode, 200);
    assert.ok(!res.body.includes(secretAccessKey));
    assert.equal(res.json().type, "ses");
    assert.deepEqual(res.json().account, { sendingEnabled: true, sandbox: true, dailyQuota: 200, maxSendRate: 1 });
    assert.ok(row);
    assert.equal(row.provider, "ses");
    assert.deepEqual(row.settings, { region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE" });
    assert.ok(!JSON.stringify(row).includes(secretAccessKey));
    assert.equal(row.encryptionKeyVersion, app.credentialsCipher.currentKeyVersion);
    assert.deepEqual(JSON.parse(await app.credentialsCipher.decrypt(row.credentialsEncrypted, organizationId)), {
      secretAccessKey,
    });
  });

  it("returns the connection without the secret, then disconnects it", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const before = await app.inject({ method: "GET", url, headers: auth(token) });
    await app.inject({ method: "PUT", url, headers: auth(token), payload: input });
    const got = await app.inject({ method: "GET", url, headers: auth(token) });
    const removed = await app.inject({ method: "DELETE", url, headers: auth(token) });
    const after = await app.inject({ method: "GET", url, headers: auth(token) });
    const removedAgain = await app.inject({ method: "DELETE", url, headers: auth(token) });

    assert.equal(before.statusCode, 404);
    assert.equal(got.statusCode, 200);
    assert.deepEqual(Object.keys(got.json()).sort(), [
      "accessKeyId",
      "createdAt",
      "eventsEnabled",
      "id",
      "region",
      "type",
      "updatedAt",
    ]);
    assert.ok(!got.body.includes(secretAccessKey));
    assert.equal(removed.statusCode, 204);
    assert.equal(after.statusCode, 404);
    assert.equal(removedAgain.statusCode, 404);
  });

  it("replaces the existing connection in place", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const first = (await app.inject({ method: "PUT", url, headers: auth(token), payload: input })).json();
    const second = (
      await app.inject({
        method: "PUT",
        url,
        headers: auth(token),
        payload: { ...input, region: "eu-west-1", accessKeyId: "AKIAI44QH8DHBEXAMPLE" },
      })
    ).json();

    assert.equal(second.id, first.id);
    assert.equal(second.region, "eu-west-1");
    assert.equal(second.accessKeyId, "AKIAI44QH8DHBEXAMPLE");
  });

  it("builds a working provider from the stored connection", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);
    await app.inject({ method: "PUT", url, headers: auth(token), payload: input });
    ses.resetHistory();

    const provider = await app.services.providerConnections.requireProvider(organizationId);
    await provider.verifyAccount();

    assert.equal(provider.type, "ses");
    assert.equal(ses.commandCalls(GetAccountCommand).length, 1);
    assert.equal(await app.services.providerConnections.loadProvider("0199c1a0-0000-7000-8000-000000000009"), null);
  });

  it("never writes the secret to the logs", async () => {
    const lines: string[] = [];
    const app = await buildTestApp({ LOG_LEVEL: "trace" }, { logStream: { write: (line) => lines.push(line) } });
    const { token } = await createTestKey(app);

    await app.inject({ method: "PUT", url, headers: auth(token), payload: input });
    app.log.info({ body: input }, "body");
    app.log.info({ request: { body: input } }, "nested body");
    app.log.info({ config: { secrets: { secretAccessKey } } }, "config");

    assert.ok(lines.length > 3);
    assert.ok(lines.every((line) => !line.includes(secretAccessKey)));
    assert.ok(lines.every((line) => !line.includes(token)));
  });
});

describe("/v1/provider failures and isolation", { skip: !hasDatabase }, () => {
  it("rejects credentials the provider refuses and stores nothing", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    ses.on(GetAccountCommand).rejects(awsError("UnrecognizedClientException", "client"));

    const res = await app.inject({ method: "PUT", url, headers: auth(token), payload: input });
    const got = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().code, "ATL_PROVIDER_REJECTED");
    assert.match(res.json().message, /UnrecognizedClientException/);
    assert.equal(got.statusCode, 404);
  });

  it("returns 502 when the provider cannot be reached", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    ses.on(GetAccountCommand).rejects(awsError("InternalFailure", "server"));
    const unreachable = await app.inject({ method: "PUT", url, headers: auth(token), payload: input });

    assert.equal(unreachable.statusCode, 502);
    assert.equal(unreachable.json().code, "ATL_PROVIDER_UNAVAILABLE");
    assert.ok(!unreachable.body.includes(secretAccessKey));
  });

  it("validates the request body", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const put = (payload: object) => app.inject({ method: "PUT", url, headers: auth(token), payload });

    assert.equal((await put({ ...input, type: "smtp" })).statusCode, 400);
    assert.equal((await put({ region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey })).statusCode, 400);
    assert.equal((await put({ ...input, region: "US East" })).statusCode, 400);
    assert.equal((await put({ ...input, accessKeyId: "not a key" })).statusCode, 400);
    assert.equal((await put({ ...input, secretAccessKey: "" })).statusCode, 400);
    assert.equal(ses.commandCalls(GetAccountCommand).length, 0);
  });

  it("requires a full_access key", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app, { permission: "sending_access" });

    assert.equal((await app.inject({ method: "PUT", url, headers: auth(token), payload: input })).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url, headers: auth(token) })).statusCode, 403);
    assert.equal((await app.inject({ method: "DELETE", url, headers: auth(token) })).statusCode, 403);
  });

  it("keeps each organization's connection separate", async () => {
    const app = await buildTestApp();
    const first = await createTestKey(app);
    const second = await createTestKey(app);
    await app.inject({ method: "PUT", url, headers: auth(first.token), payload: input });

    const read = await app.inject({ method: "GET", url, headers: auth(second.token) });
    const remove = await app.inject({ method: "DELETE", url, headers: auth(second.token) });
    await app.inject({
      method: "PUT",
      url,
      headers: auth(second.token),
      payload: { ...input, accessKeyId: "AKIAI44QH8DHBEXAMPLE" },
    });
    const firstStill = (await app.inject({ method: "GET", url, headers: auth(first.token) })).json();
    const firstRow = await storedConnection(app, first.organizationId);

    assert.equal(read.statusCode, 404);
    assert.equal(remove.statusCode, 404);
    assert.equal(firstStill.accessKeyId, input.accessKeyId);
    await assert.rejects(app.credentialsCipher.decrypt(firstRow!.credentialsEncrypted, second.organizationId));
  });

  it("refuses to start with a malformed encryption key", async () => {
    await assert.rejects(buildTestApp({ CREDENTIALS_ENCRYPTION_KEYS: "1:too-short" }), /32 bytes/);
  });
});
