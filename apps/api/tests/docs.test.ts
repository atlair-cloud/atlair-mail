import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTestApp, hasDatabase } from "./helpers.ts";

describe("API docs", { skip: !hasDatabase }, () => {
  it("serves the generated OpenAPI spec", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/docs/openapi.json" });
    const spec = res.json();

    assert.equal(res.statusCode, 200);
    assert.ok(spec.paths["/health"]);
    assert.ok(spec.paths["/v1/api-keys/current"]);
  });

  it("keeps paths, tags and descriptions provider-neutral", async () => {
    const app = await buildTestApp();

    const spec = (await app.inject({ method: "GET", url: "/docs/openapi.json" })).json();
    const operations = Object.values(spec.paths).flatMap((methods) => Object.values(methods as object));
    const text = JSON.stringify([
      Object.keys(spec.paths),
      operations.map(({ summary, description, tags }) => [summary, description, tags]),
    ]);

    assert.doesNotMatch(text, /\bses\b|amazon|aws/i);
  });

  it("serves the reference UI", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/docs/" });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/html/);
  });
});
