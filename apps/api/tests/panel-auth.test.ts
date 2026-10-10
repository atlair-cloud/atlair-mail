import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { schema } from "@atlair-mail/db";
import {
  auth,
  buildPanelTestApp,
  buildTestApp,
  createTestKey,
  hasDatabase,
  PANEL_ORIGIN,
  panelEnv,
  randomIp,
  signUp,
} from "./helpers.ts";

describe("panel auth disabled", { skip: !hasDatabase }, () => {
  it("does not register auth or panel routes without BETTER_AUTH_SECRET", async () => {
    const app = await buildTestApp();

    const ok = await app.inject({ method: "GET", url: "/api/auth/ok" });
    const me = await app.inject({ method: "GET", url: "/service/panel/me" });

    assert.equal(ok.statusCode, 404);
    assert.equal(me.statusCode, 404);
  });

  it("refuses to start with a short secret or missing settings", async () => {
    await assert.rejects(buildTestApp({ ...panelEnv, BETTER_AUTH_SECRET: "too-short" }), /at least 32 characters/);
    await assert.rejects(buildTestApp({ ...panelEnv, BETTER_AUTH_URL: "" }), /BETTER_AUTH_URL is required/);
    await assert.rejects(buildTestApp({ ...panelEnv, PANEL_ORIGINS: "" }), /PANEL_ORIGINS is required/);
    await assert.rejects(buildTestApp({ ...panelEnv, PANEL_ORIGINS: "https://panel.example.test/app" }), /must be an origin/);
    await assert.rejects(buildTestApp({ ...panelEnv, GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "" }), /GITHUB_CLIENT_ID/);
  });
});

function socialSignIn(
  app: Awaited<ReturnType<typeof buildPanelTestApp>>,
  provider: string,
  opts: { remoteAddress?: string; headers?: Record<string, string>; callbackURL?: string } = {},
) {
  return app.inject({
    method: "POST",
    url: "/api/auth/sign-in/social",
    remoteAddress: opts.remoteAddress ?? randomIp(),
    headers: { origin: PANEL_ORIGIN, ...opts.headers },
    payload: { provider, callbackURL: opts.callbackURL ?? `${PANEL_ORIGIN}/auth/callback` },
  });
}

describe("panel auth", { skip: !hasDatabase }, () => {
  it("returns the signed-in user from /service/panel/me", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app, "Ada");

    const res = await app.inject({ method: "GET", url: "/service/panel/me", headers: user.headers });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().email, user.email);
    assert.equal(res.json().name, "Ada");
    assert.equal(res.headers["api-version"], "1");
  });

  it("uses an httpOnly, SameSite=Lax session cookie", async () => {
    const app = await buildPanelTestApp();
    const { authCookies } = await app.auth!.$context;

    assert.equal(authCookies.sessionToken.name, "atlair-mail.session_token");
    assert.equal(authCookies.sessionToken.attributes.httpOnly, true);
    assert.equal(authCookies.sessionToken.attributes.sameSite, "lax");
  });

  it("records the sign-up in the audit log", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);

    const rows = await app.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.actorUserId, user.id), eq(schema.auditLogs.action, "user.signed_up")));

    assert.equal(rows.length, 1);
  });

  it("does not offer email and password sign-in", async () => {
    const app = await buildPanelTestApp();
    const email = `password-${Date.now()}@example.test`;

    const signUpRes = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { name: "Password", email, password: "correct horse battery staple" },
    });
    const signInRes = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { email, password: "correct horse battery staple" },
    });
    const users = await app.db.select().from(schema.users).where(eq(schema.users.email, email));

    assert.ok(signUpRes.statusCode >= 400);
    assert.ok(signInRes.statusCode >= 400);
    assert.equal(users.length, 0);
  });

  it("starts GitHub sign-in and returns to the panel", async () => {
    const app = await buildPanelTestApp();

    const res = await socialSignIn(app, "github");

    assert.equal(res.statusCode, 200);
    const url = new URL(res.json().url);
    assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), "github-test-client");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost/api/auth/callback/github");
  });

  it("does not offer a provider without credentials", async () => {
    const app = await buildPanelTestApp();

    const res = await socialSignIn(app, "google");

    assert.ok(res.statusCode >= 400);
  });

  it("answers 401 on panel routes without a session", async () => {
    const app = await buildPanelTestApp();

    const res = await app.inject({ method: "GET", url: "/service/panel/me" });

    assert.equal(res.statusCode, 401);
  });

  it("never accepts a session cookie on /service/web", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);

    const res = await app.inject({ method: "GET", url: "/service/web/api-keys/current", headers: user.headers });

    assert.equal(res.statusCode, 401);
  });

  it("never accepts an API key on /service/panel", async () => {
    const app = await buildPanelTestApp();
    const { token } = await createTestKey(app);

    const res = await app.inject({ method: "GET", url: "/service/panel/me", headers: auth(token) });

    assert.equal(res.statusCode, 401);
  });

  it("blocks new accounts from providers when AUTH_SIGNUP is disabled", async () => {
    const open = await buildPanelTestApp();
    const closed = await buildPanelTestApp({ AUTH_SIGNUP: "disabled" });

    assert.equal(open.auth!.options.socialProviders.github?.disableSignUp, false);
    assert.equal(closed.auth!.options.socialProviders.github?.disableSignUp, true);
  });

  it("rate limits social sign-in to 10 attempts a minute per client", async () => {
    const app = await buildPanelTestApp();
    const remoteAddress = randomIp();

    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await socialSignIn(app, "github", { remoteAddress })).statusCode);

    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.equal(statuses[10], 429);
  });

  it("keys the rate limit on the connection, not a client-supplied header", async () => {
    const app = await buildPanelTestApp();
    const remoteAddress = randomIp();

    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const res = await socialSignIn(app, "github", { remoteAddress, headers: { "x-atlair-mail-client-ip": randomIp() } });
      statuses.push(res.statusCode);
    }

    assert.equal(statuses[10], 429);
  });

  it("ends panel access on sign-out", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);

    const signOut = await app.inject({ method: "POST", url: "/api/auth/sign-out", headers: user.headers });
    const me = await app.inject({ method: "GET", url: "/service/panel/me", headers: user.headers });

    assert.equal(signOut.statusCode, 200);
    assert.equal(me.statusCode, 401);
  });

  it("rejects auth requests from an untrusted origin", async () => {
    const app = await buildPanelTestApp();

    const user = await signUp(app);
    const fromEvil = await socialSignIn(app, "github", { headers: { cookie: user.headers.cookie, origin: "https://evil.example" } });
    const toEvil = await socialSignIn(app, "github", { callbackURL: "https://evil.example/auth/callback" });

    assert.equal(fromEvil.statusCode, 403);
    assert.equal(toEvil.statusCode, 403);
  });

  it("answers CORS preflights only for the panel origin", async () => {
    const app = await buildPanelTestApp();
    const preflight = (origin: string, url: string) =>
      app.inject({
        method: "OPTIONS",
        url,
        headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
      });

    const allowed = await preflight(PANEL_ORIGIN, "/service/panel/organizations");
    const foreign = await preflight("https://evil.example", "/service/panel/organizations");
    const web = await preflight(PANEL_ORIGIN, "/service/web/emails");

    assert.equal(allowed.headers["access-control-allow-origin"], PANEL_ORIGIN);
    assert.equal(allowed.headers["access-control-allow-credentials"], "true");
    assert.equal(foreign.headers["access-control-allow-origin"], undefined);
    assert.equal(web.headers["access-control-allow-origin"], undefined);
  });
});
