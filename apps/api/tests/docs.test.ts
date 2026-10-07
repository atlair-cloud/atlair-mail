import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.ts";

describe("API docs", () => {
  it("serves the generated OpenAPI spec", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/docs/openapi.json" });
    const spec = res.json();

    assert.equal(res.statusCode, 200);
    assert.ok(spec.paths["/health"]);
    assert.ok(spec.paths["/v1/api-keys/current"]);
  });

  it("serves the reference UI", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/docs/" });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/html/);
  });
});
