import { strict as assert } from "node:assert";
import { test } from "node:test";
import { publicSpec, type OpenApiDocument } from "../src/spec.ts";

const server = "https://api.atlair.cloud/mail";

const spec: OpenApiDocument = {
  openapi: "3.0.3",
  info: { title: "atlair-mail API", version: "0.1.0" },
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      panelSession: { type: "apiKey", in: "cookie", name: "session" },
    },
  },
  tags: [{ name: "Emails" }, { name: "Panel" }, { name: "Organizations" }, { name: "Health" }],
  paths: {
    "/mail/health": { get: { tags: ["Health"] } },
    "/mail/service/panel/organizations/{organizationId}/emails/": { post: { tags: ["Emails"], security: [{ panelSession: [] }] } },
    "/mail/service/panel/me/": { get: { tags: ["Panel"], security: [{ panelSession: [] }] } },
    "/mail/service/web/organizations/": { post: { tags: ["Organizations"] } },
    "/mail/service/web/emails/": { post: { tags: ["Emails"] } },
    "/mail/service/web/emails/{id}": { get: { tags: ["Emails"] } },
  },
};

test("keeps only the public API, without the base path or trailing slashes", () => {
  const result = publicSpec(spec, server, { title: "Atlair Mail API" });
  assert.deepEqual(Object.keys(result.paths), ["/service/web/emails", "/service/web/emails/{id}"]);
  assert.deepEqual(result.servers, [{ url: server }]);
});

test("drops tags and security schemes only the hidden routes use", () => {
  const result = publicSpec(spec, server, {});
  assert.deepEqual(result.tags, [{ name: "Emails" }]);
  assert.deepEqual(Object.keys(result.components?.securitySchemes ?? {}), ["bearerAuth"]);
});

test("merges the given info over the original", () => {
  const result = publicSpec(spec, server, { title: "Atlair Mail API", description: "Guide" });
  assert.deepEqual(result.info, { title: "Atlair Mail API", version: "0.1.0", description: "Guide" });
});
