import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp, hasDatabase, UNREACHABLE_DATABASE_URL } from "./helpers.ts";

describe("GET /health", () => {
  it("returns ok without an API key when Postgres is reachable", { skip: !hasDatabase }, async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "ok");
    assert.equal(typeof res.json().uptime, "number");
  });

  it("returns 503 when Postgres is unreachable", async () => {
    const app = await buildTestApp({ DATABASE_URL: UNREACHABLE_DATABASE_URL });

    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 503);
    assert.ok(res.headers["retry-after"]);
  });

  it("sheds every other route while Postgres is unreachable", async () => {
    const app = await buildTestApp({ DATABASE_URL: UNREACHABLE_DATABASE_URL });

    const res = await app.inject({ method: "GET", url: "/service/web/api-keys/current" });

    assert.equal(res.statusCode, 503);
  });
});
