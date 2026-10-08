import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { mockClient } from "aws-sdk-client-mock";
import { GetAccountCommand, SESv2Client, SESv2ServiceException } from "@aws-sdk/client-sesv2";
import { schema } from "@atlair-mail/db";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/v1/ses-connection";
const secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const credentials = { region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey };

const ses = mockClient(SESv2Client);

const sandboxAccount = {
  SendingEnabled: true,
  ProductionAccessEnabled: false,
  SendQuota: { Max24HourSend: 200, MaxSendRate: 1, SentLast24Hours: 0 },
};

const awsError = (name: string, fault: "client" | "server") =>
  new SESv2ServiceException({ name, $fault: fault, $metadata: {}, message: name });

beforeEach(() => {
  ses.reset();
  ses.on(GetAccountCommand).resolves(sandboxAccount);
});

describe("/v1/ses-connection", { skip: !hasDatabase }, () => {
  it("checks the credentials with SES and stores only ciphertext", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);

    const res = await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });
    const [row] = await app.db
      .select()
      .from(schema.sesConnections)
      .where(eq(schema.sesConnections.organizationId, organizationId));

    assert.equal(res.statusCode, 200);
    assert.ok(!res.body.includes(secretAccessKey));
    assert.deepEqual(res.json().account, {
      sendingEnabled: true,
      productionAccessEnabled: false,
      max24HourSend: 200,
      maxSendRate: 1,
    });
    assert.equal(ses.commandCalls(GetAccountCommand).length, 1);
    assert.ok(row);
    assert.ok(!Object.values(row).some((value) => String(value).includes(secretAccessKey)));
    assert.equal(row.encryptionKeyVersion, app.credentialsCipher.currentKeyVersion);
    assert.equal(await app.credentialsCipher.decrypt(row.secretAccessKeyEncrypted, organizationId), secretAccessKey);
  });

  it("returns the connection without the secret, then removes it", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const before = await app.inject({ method: "GET", url, headers: auth(token) });
    await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });
    const got = await app.inject({ method: "GET", url, headers: auth(token) });
    const removed = await app.inject({ method: "DELETE", url, headers: auth(token) });
    const after = await app.inject({ method: "GET", url, headers: auth(token) });
    const removedAgain = await app.inject({ method: "DELETE", url, headers: auth(token) });

    assert.equal(before.statusCode, 404);
    assert.equal(got.statusCode, 200);
    assert.deepEqual(Object.keys(got.json()).sort(), [
      "accessKeyId",
      "configurationSet",
      "createdAt",
      "id",
      "region",
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

    const first = (await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials })).json();
    const second = (
      await app.inject({
        method: "PUT",
        url,
        headers: auth(token),
        payload: { ...credentials, region: "eu-west-1", accessKeyId: "AKIAI44QH8DHBEXAMPLE" },
      })
    ).json();

    assert.equal(second.id, first.id);
    assert.equal(second.region, "eu-west-1");
    assert.equal(second.accessKeyId, "AKIAI44QH8DHBEXAMPLE");
  });

  it("gives the send path the decrypted credentials", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);
    await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });

    assert.deepEqual(await app.services.sesConnections.loadCredentials(organizationId), credentials);
  });

  it("never writes the secret to the logs", async () => {
    const lines: string[] = [];
    const app = await buildTestApp({ LOG_LEVEL: "trace" }, { logStream: { write: (line) => lines.push(line) } });
    const { token } = await createTestKey(app);

    await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });
    app.log.info({ body: credentials }, "body");
    app.log.info({ request: { body: credentials } }, "nested body");

    assert.ok(lines.length > 2);
    assert.ok(lines.every((line) => !line.includes(secretAccessKey)));
    assert.ok(lines.every((line) => !line.includes(token)));
  });
});

describe("/v1/ses-connection failures and isolation", { skip: !hasDatabase }, () => {
  it("rejects credentials SES refuses and stores nothing", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    ses.on(GetAccountCommand).rejects(awsError("UnrecognizedClientException", "client"));

    const res = await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });
    const got = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(res.statusCode, 422);
    assert.match(res.json().message, /UnrecognizedClientException/);
    assert.equal(got.statusCode, 404);
  });

  it("returns 502 when SES cannot be reached", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    ses.on(GetAccountCommand).rejects(awsError("InternalFailure", "server"));

    const res = await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials });

    assert.equal(res.statusCode, 502);
    assert.ok(!res.body.includes(secretAccessKey));
  });

  it("validates the request body", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const put = (payload: object) => app.inject({ method: "PUT", url, headers: auth(token), payload });

    assert.equal((await put({ ...credentials, region: "US East" })).statusCode, 400);
    assert.equal((await put({ ...credentials, accessKeyId: "not a key" })).statusCode, 400);
    assert.equal((await put({ ...credentials, secretAccessKey: "" })).statusCode, 400);
    assert.equal(ses.commandCalls(GetAccountCommand).length, 0);
  });

  it("requires a full_access key", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app, { permission: "sending_access" });

    assert.equal((await app.inject({ method: "PUT", url, headers: auth(token), payload: credentials })).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url, headers: auth(token) })).statusCode, 403);
    assert.equal((await app.inject({ method: "DELETE", url, headers: auth(token) })).statusCode, 403);
  });

  it("keeps each organization's connection separate", async () => {
    const app = await buildTestApp();
    const first = await createTestKey(app);
    const second = await createTestKey(app);
    await app.inject({ method: "PUT", url, headers: auth(first.token), payload: credentials });

    const read = await app.inject({ method: "GET", url, headers: auth(second.token) });
    const remove = await app.inject({ method: "DELETE", url, headers: auth(second.token) });
    await app.inject({
      method: "PUT",
      url,
      headers: auth(second.token),
      payload: { ...credentials, accessKeyId: "AKIAI44QH8DHBEXAMPLE" },
    });
    const firstStill = (await app.inject({ method: "GET", url, headers: auth(first.token) })).json();

    assert.equal(read.statusCode, 404);
    assert.equal(remove.statusCode, 404);
    assert.equal(firstStill.accessKeyId, credentials.accessKeyId);
    await assert.rejects(app.credentialsCipher.decrypt(
      (await app.db
        .select()
        .from(schema.sesConnections)
        .where(eq(schema.sesConnections.organizationId, first.organizationId)))[0]!.secretAccessKeyEncrypted,
      second.organizationId,
    ));
  });

  it("refuses to start with a malformed encryption key", async () => {
    await assert.rejects(buildTestApp({ CREDENTIALS_ENCRYPTION_KEYS: "1:too-short" }), /32 bytes/);
  });
});
