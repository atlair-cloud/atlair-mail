import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp, TEST_KEY } from "./helpers.ts";

const url = "/v1/api-keys/current";
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("/v1 auth", () => {
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

  it("accepts a valid key and exposes its id", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url, headers: auth(TEST_KEY) });

    assert.equal(res.statusCode, 200);
    assert.match(res.json().id, /^key_[0-9a-f]{12}$/);
  });
});

describe("/v1 rate limit", () => {
  it("returns 429 once a key exceeds RATE_LIMIT_MAX", async () => {
    const app = await buildTestApp({ RATE_LIMIT_MAX: 2 });
    const send = () => app.inject({ method: "GET", url, headers: auth(TEST_KEY) });

    assert.equal((await send()).statusCode, 200);
    assert.equal((await send()).statusCode, 200);
    const limited = await send();

    assert.equal(limited.statusCode, 429);
    assert.ok(limited.headers["retry-after"]);
  });

  it("counts each key separately", async () => {
    const app = await buildTestApp({ RATE_LIMIT_MAX: 1, API_KEYS: `${TEST_KEY},am_other` });

    await app.inject({ method: "GET", url, headers: auth(TEST_KEY) });
    const other = await app.inject({ method: "GET", url, headers: auth("am_other") });

    assert.equal(other.statusCode, 200);
  });
});
