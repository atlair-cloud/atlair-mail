import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.ts";

describe("GET /health", () => {
  it("returns ok without an API key", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, "ok");
    assert.equal(typeof res.json().uptime, "number");
  });
});
