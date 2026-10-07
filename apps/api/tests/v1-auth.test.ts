import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/v1/api-keys/current";

describe("/v1 auth", { skip: !hasDatabase }, () => {
  it("rejects a missing key", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url });

    assert.equal(res.statusCode, 401);
  });

  it("rejects an unknown key", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url, headers: auth("am_wrong") });

    assert.equal(res.statusCode, 401);
  });

  it("rejects a revoked key", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app, { revoked: true });

    const res = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(res.statusCode, 401);
  });

  it("accepts a key from Postgres and returns only the listed fields", async () => {
    const app = await buildTestApp();
    const { token, keyId, organizationId } = await createTestKey(app, {
      permission: "sending_access",
    });

    const res = await app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { id: keyId, organizationId, permission: "sending_access" });
  });
});

describe("/v1 rate limit", { skip: !hasDatabase }, () => {
  it("returns 429 once a key exceeds RATE_LIMIT_MAX", async () => {
    const app = await buildTestApp({ RATE_LIMIT_MAX: 2 });
    const { token } = await createTestKey(app);
    const send = () => app.inject({ method: "GET", url, headers: auth(token) });

    assert.equal((await send()).statusCode, 200);
    assert.equal((await send()).statusCode, 200);
    const limited = await send();

    assert.equal(limited.statusCode, 429);
    assert.ok(limited.headers["retry-after"]);
  });

  it("counts each key separately", async () => {
    const app = await buildTestApp({ RATE_LIMIT_MAX: 1 });
    const first = await createTestKey(app);
    const second = await createTestKey(app);

    await app.inject({ method: "GET", url, headers: auth(first.token) });
    const other = await app.inject({ method: "GET", url, headers: auth(second.token) });

    assert.equal(other.statusCode, 200);
  });
});
