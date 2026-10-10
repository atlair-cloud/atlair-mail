import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { apiVersionConstraint } from "../src/lib/api-version.ts";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

function versionedRouter() {
  const app = Fastify({ routerOptions: { constraints: { apiVersion: apiVersionConstraint } } });
  app.get("/shared", { constraints: { apiVersion: ["1", "2"] } }, async () => ({ route: "shared" }));
  app.get("/split", { constraints: { apiVersion: ["1"] } }, async () => ({ served: "1" }));
  app.get("/split", { constraints: { apiVersion: ["2"] } }, async () => ({ served: "2" }));
  app.get("/neutral", async () => ({ route: "neutral" }));
  return app;
}

describe("api version constraint", () => {
  it("serves a request without the header as version 1", async () => {
    const res = await versionedRouter().inject({ method: "GET", url: "/split" });
    assert.deepEqual(res.json(), { served: "1" });
  });

  it("routes each version to its own handler", async () => {
    const res = await versionedRouter().inject({ method: "GET", url: "/split", headers: { "api-version": "2" } });
    assert.deepEqual(res.json(), { served: "2" });
  });

  it("lets one route serve several versions", async () => {
    const app = versionedRouter();
    for (const version of ["1", "2"]) {
      const res = await app.inject({ method: "GET", url: "/shared", headers: { "api-version": version } });
      assert.equal(res.statusCode, 200);
    }
    const res = await app.inject({ method: "GET", url: "/shared", headers: { "api-version": "3" } });
    assert.equal(res.statusCode, 404);
  });

  it("matches unconstrained routes for any version", async () => {
    const res = await versionedRouter().inject({ method: "GET", url: "/neutral", headers: { "api-version": "7" } });
    assert.equal(res.statusCode, 200);
  });

  it("rejects malformed version lists when a route is registered", () => {
    const app = Fastify({ routerOptions: { constraints: { apiVersion: apiVersionConstraint } } });
    assert.throws(() => app.get("/bad", { constraints: { apiVersion: "1" } }, async () => ({})));
    assert.throws(() => app.get("/bad", { constraints: { apiVersion: ["v1"] } }, async () => ({})));
  });
});

describe("api versioning on /service", { skip: !hasDatabase }, () => {
  it("serves version 1 by default and says so in the response", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const res = await app.inject({ method: "GET", url: "/service/web/api-keys/current", headers: auth(token) });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["api-version"], "1");
    assert.match(res.headers.vary as string, /api-version/);
  });

  it("accepts an explicit supported version", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const res = await app.inject({
      method: "GET",
      url: "/service/web/api-keys/current",
      headers: { ...auth(token), "api-version": "1" },
    });

    assert.equal(res.statusCode, 200);
  });

  it("rejects an unsupported version with 400", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const res = await app.inject({
      method: "GET",
      url: "/service/web/api-keys/current",
      headers: { ...auth(token), "api-version": "9" },
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /Unsupported API version 9\. Supported versions: 1/);
  });

  it("still answers 404 for unknown routes on a supported version", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/service/web/nope" });

    assert.equal(res.statusCode, 404);
  });

  it("no longer serves /v1", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const res = await app.inject({ method: "GET", url: "/v1/api-keys/current", headers: auth(token) });

    assert.equal(res.statusCode, 404);
  });

  it("keeps version-neutral routes outside /service", async () => {
    const app = await buildTestApp();

    const res = await app.inject({ method: "GET", url: "/health", headers: { "api-version": "9" } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["api-version"], undefined);
  });

  it("documents the header on versioned routes", async () => {
    const app = await buildTestApp();

    const spec = (await app.inject({ method: "GET", url: "/docs/openapi.json" })).json();
    const parameters = spec.paths["/service/web/api-keys/current"].get.parameters;

    assert.ok(parameters.some((p: { in: string; name: string }) => p.in === "header" && p.name === "api-version"));
  });
});
