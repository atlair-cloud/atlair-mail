import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { schema } from "@atlair-mail/db";
import { v7 as uuidv7 } from "uuid";
import { hashApiKeyToken } from "../src/lib/api-key-tokens.ts";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/v1/api-keys";

describe("/v1/api-keys lifecycle", { skip: !hasDatabase }, () => {
  it("shows the token once at creation and stores only its hash", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const created = await app.inject({
      method: "POST",
      url,
      headers: auth(token),
      payload: { name: "CI", permission: "sending_access" },
    });
    const body = created.json();
    const [row] = await app.db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, body.id));
    const listed = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(created.statusCode, 201);
    assert.equal(body.permission, "sending_access");
    assert.ok(body.token.startsWith(body.tokenPrefix));
    assert.equal(row?.tokenHash, hashApiKeyToken(body.token));
    assert.ok(!Object.values(row!).includes(body.token));
    assert.equal(listed.statusCode, 200);
    for (const key of listed.json().data) {
      assert.deepEqual(Object.keys(key).sort(), [
        "createdAt",
        "id",
        "lastUsedAt",
        "name",
        "permission",
        "revokedAt",
        "tokenPrefix",
      ]);
    }
  });

  it("creates a key that works, then returns 401 once it is revoked", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const created = (
      await app.inject({ method: "POST", url, headers: auth(token), payload: { name: "Temp" } })
    ).json();

    const before = await app.inject({ method: "GET", url: `${url}/current`, headers: auth(created.token) });
    const revoked = await app.inject({ method: "DELETE", url: `${url}/${created.id}`, headers: auth(token) });
    const after = await app.inject({ method: "GET", url: `${url}/current`, headers: auth(created.token) });
    const again = await app.inject({ method: "DELETE", url: `${url}/${created.id}`, headers: auth(token) });

    assert.equal(before.statusCode, 200);
    assert.equal(revoked.statusCode, 200);
    assert.ok(revoked.json().revokedAt);
    assert.equal(after.statusCode, 401);
    assert.equal(again.statusCode, 200);
    assert.equal(again.json().revokedAt, revoked.json().revokedAt);
  });

  it("lists keys newest first, including revoked ones", async () => {
    const app = await buildTestApp();
    const { token, keyId } = await createTestKey(app);
    const created = (
      await app.inject({ method: "POST", url, headers: auth(token), payload: { name: "Second" } })
    ).json();
    await app.inject({ method: "DELETE", url: `${url}/${created.id}`, headers: auth(token) });

    const { data } = (await app.inject({ method: "GET", url, headers: auth(token) })).json();

    assert.deepEqual(
      data.map((key: { id: string }) => key.id),
      [created.id, keyId],
    );
    assert.ok(data[0].revokedAt);
    assert.equal(data[1].revokedAt, null);
  });

  it("records when a key was last used", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    await app.inject({ method: "GET", url: `${url}/current`, headers: auth(token) });
    const { data } = (await app.inject({ method: "GET", url, headers: auth(token) })).json();

    assert.ok(data[0].lastUsedAt);
  });

  it("rejects an invalid name, permission, or id", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const create = (payload: object) =>
      app.inject({ method: "POST", url, headers: auth(token), payload });

    assert.equal((await create({ name: "" })).statusCode, 400);
    assert.equal((await create({ name: "x".repeat(51) })).statusCode, 400);
    assert.equal((await create({ name: "Admin", permission: "admin" })).statusCode, 400);
    assert.equal(
      (await app.inject({ method: "DELETE", url: `${url}/not-a-uuid`, headers: auth(token) })).statusCode,
      400,
    );
    assert.equal(
      (await app.inject({ method: "DELETE", url: `${url}/${uuidv7()}`, headers: auth(token) })).statusCode,
      404,
    );
  });
});

describe("/v1/api-keys permissions and isolation", { skip: !hasDatabase }, () => {
  it("lets a sending_access key identify itself but not manage keys", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app, { permission: "sending_access" });

    const current = await app.inject({ method: "GET", url: `${url}/current`, headers: auth(token) });
    const create = await app.inject({ method: "POST", url, headers: auth(token), payload: { name: "Escalate" } });
    const list = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(current.statusCode, 200);
    assert.equal(create.statusCode, 403);
    assert.equal(list.statusCode, 403);
  });

  it("never lets one organization see or revoke another organization's keys", async () => {
    const app = await buildTestApp();
    const first = await createTestKey(app);
    const second = await createTestKey(app);

    const { data } = (await app.inject({ method: "GET", url, headers: auth(second.token) })).json();
    const revoke = await app.inject({
      method: "DELETE",
      url: `${url}/${first.keyId}`,
      headers: auth(second.token),
    });
    const stillWorks = await app.inject({
      method: "GET",
      url: `${url}/current`,
      headers: auth(first.token),
    });

    assert.deepEqual(
      data.map((key: { id: string }) => key.id),
      [second.keyId],
    );
    assert.equal(revoke.statusCode, 404);
    assert.equal(stillWorks.statusCode, 200);
  });
});
