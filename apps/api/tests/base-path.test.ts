import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { auth, buildPanelTestApp, buildTestApp, createTestKey, hasDatabase, PANEL_ORIGIN, panelEnv, randomIp } from "./helpers.ts";

const basePath = "/mail";

describe("BASE_PATH", { skip: !hasDatabase }, () => {
  it("serves health, docs and email assets under the prefix and nothing at the root", async () => {
    const app = await buildTestApp({ BASE_PATH: basePath });

    assert.equal((await app.inject({ url: "/mail/health" })).statusCode, 200);
    assert.equal((await app.inject({ url: "/mail/health/ready" })).json().status, "ok");
    assert.equal((await app.inject({ url: "/mail/docs/" })).statusCode, 200);
    assert.equal((await app.inject({ url: "/mail/assets/social/github-dark.png" })).headers["content-type"], "image/png");
    const spec = (await app.inject({ url: "/mail/docs/openapi.json" })).json();
    assert.ok(spec.paths["/mail/service/web/emails/"]);
    assert.ok(spec.paths["/mail/service/web/emails/"].post.parameters.some((parameter: { name: string }) => parameter.name === "api-version"));

    for (const url of ["/health", "/docs/", "/assets/social/github-dark.png", "/service/web/emails"]) {
      assert.equal((await app.inject({ url })).statusCode, 404, url);
    }
  });

  it("serves the API-key routes under the prefix, with the version check", async () => {
    const app = await buildTestApp({ BASE_PATH: basePath });
    const { token } = await createTestKey(app);

    assert.equal((await app.inject({ url: "/mail/service/web/domains", headers: auth(token) })).statusCode, 200);
    const unsupported = await app.inject({ url: "/mail/service/web/nope", headers: { ...auth(token), "api-version": "9" } });
    assert.equal(unsupported.statusCode, 400);
    assert.match(unsupported.json().message, /Unsupported API version 9/);
  });

  it("runs sign-in under the prefix, so OAuth calls back to the prefixed path", async () => {
    const app = await buildPanelTestApp({ BASE_PATH: basePath });

    const res = await app.inject({
      method: "POST",
      url: "/mail/api/auth/sign-in/social",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { provider: "github", callbackURL: `${PANEL_ORIGIN}/auth/callback` },
    });
    assert.equal(res.statusCode, 200);
    const redirect = new URL(res.json().url).searchParams.get("redirect_uri");
    assert.equal(redirect, "http://localhost/mail/api/auth/callback/github");
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/sign-in/social", headers: { origin: PANEL_ORIGIN } })).statusCode, 404);

    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/mail/service/panel/me",
      headers: { origin: PANEL_ORIGIN, "access-control-request-method": "GET" },
    });
    assert.equal(preflight.headers["access-control-allow-origin"], PANEL_ORIGIN);
    assert.equal((await app.inject({ url: "/mail/service/panel/me" })).statusCode, 401);
  });

  it("refuses a BETTER_AUTH_URL with a path, which Better Auth would read as the whole sign-in URL", async () => {
    await assert.rejects(buildTestApp({ ...panelEnv, BETTER_AUTH_URL: "http://localhost/mail", BASE_PATH: basePath }), /must be an origin/);
  });
});
