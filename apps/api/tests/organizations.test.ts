import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import {
  auth,
  buildMigratedTestApp,
  buildTestApp,
  createTestKey,
  deleteOrganizationAfterTest,
  hasDatabase,
  TEST_ROOT_KEY,
} from "./helpers.ts";

const url = "/service/web/organizations";

describe("POST /service/web/organizations", { skip: !hasDatabase }, () => {
  it("creates an organization and its first key with the root key", async () => {
    const app = await buildMigratedTestApp();

    const res = await app.inject({
      method: "POST",
      url,
      headers: auth(TEST_ROOT_KEY),
      payload: { name: "Acme" },
    });
    const body = res.json();
    deleteOrganizationAfterTest(app, body.id);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(Object.keys(body).sort(), ["apiKey", "createdAt", "id", "name", "slug"]);
    assert.equal(body.name, "Acme");
    assert.deepEqual(Object.keys(body.apiKey).sort(), [
      "createdAt",
      "id",
      "name",
      "permission",
      "token",
      "tokenPrefix",
    ]);
    assert.equal(body.apiKey.permission, "full_access");
    assert.ok(body.apiKey.token.startsWith(body.apiKey.tokenPrefix));
  });

  it("returns a first key that authenticates as the new organization", async () => {
    const app = await buildMigratedTestApp();
    const created = (
      await app.inject({ method: "POST", url, headers: auth(TEST_ROOT_KEY), payload: { name: "Acme" } })
    ).json();
    deleteOrganizationAfterTest(app, created.id);

    const res = await app.inject({
      method: "GET",
      url: "/service/web/api-keys/current",
      headers: auth(created.apiKey.token),
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().organizationId, created.id);
  });

  it("rejects an empty name", async () => {
    const app = await buildMigratedTestApp();

    const res = await app.inject({
      method: "POST",
      url,
      headers: auth(TEST_ROOT_KEY),
      payload: { name: "" },
    });

    assert.equal(res.statusCode, 400);
  });

  it("returns 401 without a key and 403 with an organization key", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    const missing = await app.inject({ method: "POST", url, payload: { name: "Acme" } });
    const organizationKey = await app.inject({
      method: "POST",
      url,
      headers: auth(token),
      payload: { name: "Acme" },
    });

    assert.equal(missing.statusCode, 401);
    assert.equal(organizationKey.statusCode, 403);
  });

  it("treats every token as unknown when ROOT_API_KEY is unset", async () => {
    const app = await buildTestApp({ ROOT_API_KEY: "" });

    const res = await app.inject({
      method: "POST",
      url,
      headers: auth(TEST_ROOT_KEY),
      payload: { name: "Acme" },
    });

    assert.equal(res.statusCode, 401);
  });
});

describe("GET /service/web/organizations/:id", { skip: !hasDatabase }, () => {
  it("returns the organization to the root key without internal fields", async () => {
    const app = await buildTestApp();
    const { organizationId } = await createTestKey(app);

    const res = await app.inject({
      method: "GET",
      url: `${url}/${organizationId}`,
      headers: auth(TEST_ROOT_KEY),
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(res.json()).sort(), ["createdAt", "id", "name", "slug"]);
    assert.equal(res.json().id, organizationId);
  });

  it("returns 404 for an unknown id and 400 for a malformed one", async () => {
    const app = await buildMigratedTestApp();

    const unknown = await app.inject({
      method: "GET",
      url: `${url}/${uuidv7()}`,
      headers: auth(TEST_ROOT_KEY),
    });
    const malformed = await app.inject({
      method: "GET",
      url: `${url}/not-a-uuid`,
      headers: auth(TEST_ROOT_KEY),
    });

    assert.equal(unknown.statusCode, 404);
    assert.equal(malformed.statusCode, 400);
  });

  it("returns 403 to an organization key", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);

    const res = await app.inject({
      method: "GET",
      url: `${url}/${organizationId}`,
      headers: auth(token),
    });

    assert.equal(res.statusCode, 403);
  });
});

describe("organization-scoped routes", { skip: !hasDatabase }, () => {
  it("return 403 to the root key", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/service/web/api-keys/current",
      headers: auth(TEST_ROOT_KEY),
    });

    assert.equal(res.statusCode, 403);
  });
});
