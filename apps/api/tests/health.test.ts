import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp, hasDatabase, UNREACHABLE_DATABASE_URL } from "./helpers.ts";

describe("GET /health", () => {
  it("returns ok without an API key", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "ok");
    assert.equal(typeof res.json().uptime, "number");
  });

  it("stays ok while Postgres is unreachable", async () => {
    const app = await buildTestApp({ DATABASE_URL: UNREACHABLE_DATABASE_URL });

    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 200);
  });
});

describe("GET /health/ready", () => {
  it("returns ok without an API key when Postgres is reachable", { skip: !hasDatabase }, async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health/ready" });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: "ok" });
  });

  it("returns 503 with Retry-After when Postgres is unreachable", async () => {
    const app = await buildTestApp({ DATABASE_URL: UNREACHABLE_DATABASE_URL });

    const res = await app.inject({ method: "GET", url: "/health/ready" });

    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["retry-after"], "10");
  });
});
