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
  });
});

describe("panel auth", { skip: !hasDatabase }, () => {
  it("signs a user up and returns them from /service/panel/me", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app, "Ada");

    const res = await app.inject({ method: "GET", url: "/service/panel/me", headers: user.headers });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().email, user.email);
    assert.equal(res.json().name, "Ada");
    assert.equal(res.headers["api-version"], "1");
  });

  it("sets an httpOnly, SameSite=Lax session cookie", async () => {
    const app = await buildPanelTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { name: "Cookie", email: `cookie-${Date.now()}@example.test`, password: "correct horse battery staple" },
    });
    const session = res.cookies.find((cookie) => cookie.name === "atlair-mail.session_token");
    await app.db.delete(schema.users).where(eq(schema.users.id, res.json().user.id));

    assert.ok(session);
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, "Lax");
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

  it("rejects short passwords", async () => {
    const app = await buildPanelTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { name: "Short", email: `short-${Date.now()}@example.test`, password: "short" },
    });

    assert.equal(res.statusCode, 400);
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

  it("blocks sign-up when AUTH_SIGNUP is disabled", async () => {
    const app = await buildPanelTestApp({ AUTH_SIGNUP: "disabled" });
    const email = `closed-${Date.now()}@example.test`;

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { name: "Closed", email, password: "correct horse battery staple" },
    });
    const users = await app.db.select().from(schema.users).where(eq(schema.users.email, email));

    assert.ok(res.statusCode >= 400);
    assert.equal(users.length, 0);
  });

  it("rate limits sign-in to 5 attempts a minute per client", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);
    const remoteAddress = randomIp();

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress,
        headers: { origin: PANEL_ORIGIN },
        payload: { email: user.email, password: "wrong password entirely" },
      });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).statusCode);

    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(statuses[5], 429);
  });

  it("keys the rate limit on the connection, not a client-supplied header", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);
    const remoteAddress = randomIp();

    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        remoteAddress,
        headers: { origin: PANEL_ORIGIN, "x-atlair-mail-client-ip": randomIp() },
        payload: { email: user.email, password: "wrong password entirely" },
      });
      statuses.push(res.statusCode);
    }

    assert.equal(statuses[5], 429);
  });

  it("signs in with the right password", async () => {
    const app = await buildPanelTestApp();
    const user = await signUp(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      remoteAddress: randomIp(),
      headers: { origin: PANEL_ORIGIN },
      payload: { email: user.email, password: user.password },
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.cookies.some((cookie) => cookie.name === "atlair-mail.session_token"));
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

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      remoteAddress: randomIp(),
      headers: { origin: "https://evil.example" },
      payload: { name: "Evil", email: `evil-${Date.now()}@example.test`, password: "correct horse battery staple" },
    });

    assert.equal(res.statusCode, 403);
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
