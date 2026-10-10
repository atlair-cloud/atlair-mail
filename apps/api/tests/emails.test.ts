import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { schema } from "@atlair-mail/db";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";

const url = "/service/web/emails";
type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

async function sender(app: TestApp, opts: { permission?: "sending_access"; status?: "verified" | "pending" } = {}) {
  const key = await createTestKey(app, { permission: opts.permission });
  const name = `${uuidv7()}.example.com`;
  await app.db
    .insert(schema.domains)
    .values({ organizationId: key.organizationId, name, status: opts.status ?? "verified" });
  return { ...key, domain: name, from: `Acme <hello@${name}>` };
}

const send = (app: TestApp, token: string, payload: object, headers: Record<string, string> = {}) =>
  app.inject({ method: "POST", url, headers: { ...auth(token), ...headers }, payload });

const message = (from: string, overrides: object = {}) => ({
  from,
  to: ["Ada <Ada@Example.org>"],
  subject: "Welcome",
  html: "<p>Hi</p>",
  text: "Hi",
  ...overrides,
});

describe("POST /service/web/emails", { skip: !hasDatabase }, () => {
  it("queues the email and returns 202 with only public fields", async () => {
    const app = await buildTestApp();
    const { token, from, organizationId, keyId } = await sender(app);

    const res = await send(app, token, message(from, { tags: [{ name: "campaign", value: "welcome" }] }));
    const body = res.json();
    const [row] = await app.db.select().from(schema.emails).where(eq(schema.emails.id, body.id));

    assert.equal(res.statusCode, 202);
    assert.deepEqual(Object.keys(body).sort(), ["createdAt", "id", "scheduledAt", "status"]);
    assert.equal(body.status, "queued");
    assert.equal(row?.organizationId, organizationId);
    assert.equal(row?.apiKeyId, keyId);
    assert.equal(row?.fromAddress, from.replace("Acme", '"Acme"'));
    assert.deepEqual(row?.toAddresses, ['"Ada" <Ada@example.org>']);
    assert.equal(row?.idempotencyKey, null);
  });

  it("lets a sending_access key send and read", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app, { permission: "sending_access" });

    const res = await send(app, token, message(from));
    const got = await app.inject({ method: "GET", url: `${url}/${res.json().id}`, headers: auth(token) });

    assert.equal(res.statusCode, 202);
    assert.equal(got.statusCode, 200);
    assert.equal(got.json().subject, "Welcome");
    assert.deepEqual(Object.keys(got.json()).sort(), [
      "bcc", "cc", "createdAt", "from", "headers", "html", "id", "lastError", "providerMessageId", "replyTo",
      "scheduledAt", "sentAt", "status", "subject", "tags", "text", "to", "updatedAt",
    ]);
  });

  it("replays the same email for a repeated Idempotency-Key", async () => {
    const app = await buildTestApp();
    const { token, from, organizationId } = await sender(app);
    const headers = { "idempotency-key": "order-42-welcome" };

    const first = await send(app, token, message(from), headers);
    const again = await send(app, token, message(from), headers);
    const rows = await app.db.select().from(schema.emails).where(eq(schema.emails.organizationId, organizationId));

    assert.equal(first.statusCode, 202);
    assert.equal(again.statusCode, 202);
    assert.equal(again.json().id, first.json().id);
    assert.equal(again.headers["idempotent-replayed"], "true");
    assert.equal(first.headers["idempotent-replayed"], undefined);
    assert.equal(rows.length, 1);
  });

  it("handles concurrent requests with the same key without duplicating", async () => {
    const app = await buildTestApp();
    const { token, from, organizationId } = await sender(app);
    const headers = { "idempotency-key": "burst" };

    const results = await Promise.all(Array.from({ length: 5 }, () => send(app, token, message(from), headers)));
    const rows = await app.db.select().from(schema.emails).where(eq(schema.emails.organizationId, organizationId));

    assert.ok(results.every((res) => res.statusCode === 202));
    assert.equal(new Set(results.map((res) => res.json().id)).size, 1);
    assert.equal(rows.length, 1);
  });

  it("rejects a reused Idempotency-Key with a different body", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);
    const headers = { "idempotency-key": "order-43" };

    await send(app, token, message(from), headers);
    const changed = await send(app, token, message(from, { subject: "Different" }), headers);

    assert.equal(changed.statusCode, 422);
    assert.equal(changed.json().code, "ATL_IDEMPOTENCY_KEY_REUSED");
  });

  it("schedules within 30 days and treats past times as now", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);
    const later = new Date(Date.now() + 86_400_000).toISOString();

    const scheduled = await send(app, token, message(from, { scheduledAt: later }));
    const past = await send(app, token, message(from, { scheduledAt: "2020-01-01T00:00:00Z" }));
    const tooFar = await send(app, token, message(from, { scheduledAt: new Date(Date.now() + 31 * 86_400_000).toISOString() }));

    assert.equal(scheduled.json().scheduledAt, later);
    assert.ok(new Date(past.json().scheduledAt).getFullYear() >= 2026);
    assert.equal(tooFar.statusCode, 400);
    assert.equal(tooFar.json().code, "ATL_SCHEDULE_TOO_FAR");
  });
});

describe("POST /service/web/emails rejections", { skip: !hasDatabase }, () => {
  it("rejects a From domain that is missing, pending, or belongs to another organization", async () => {
    const app = await buildTestApp();
    const mine = await sender(app);
    const pending = await sender(app, { status: "pending" });
    const other = await sender(app);

    const missing = await send(app, mine.token, message("hello@not-added.example.com"));
    const unverified = await send(app, pending.token, message(pending.from));
    const spoofed = await send(app, mine.token, message(other.from));

    for (const res of [missing, unverified, spoofed]) {
      assert.equal(res.statusCode, 422);
      assert.equal(res.json().code, "ATL_DOMAIN_NOT_VERIFIED");
    }
    assert.match(spoofed.json().message, /POST \/service\/web\/domains/);
  });

  it("rejects suppressed recipients and names them", async () => {
    const app = await buildTestApp();
    const { token, from, organizationId } = await sender(app);
    await app.db
      .insert(schema.suppressedAddresses)
      .values({ organizationId, address: "bounced@example.org", reason: "hard_bounce" });

    const res = await send(app, token, message(from, { bcc: ["Bounced@Example.org"] }));

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().code, "ATL_RECIPIENT_SUPPRESSED");
    assert.match(res.json().message, /bounced@example\.org/);
  });

  it("blocks header injection in every field", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);
    const injected = "x\r\nBcc: victim@example.org";

    for (const overrides of [
      { from: `${from}\r\nBcc: victim@example.org` },
      { to: [`ada@example.org${injected}`] },
      { replyTo: [`support@example.org\nBcc: victim@example.org`] },
      { subject: `Hi${injected}` },
      { headers: { "X-Campaign": `fall${injected}` } },
      { headers: { "X-Campaign\r\nBcc": "victim@example.org" } },
      { headers: { "X Bad": "1" } },
    ]) {
      const res = await send(app, token, message(from, overrides));
      assert.equal(res.statusCode, 400, JSON.stringify(overrides));
    }
  });

  it("blocks reserved headers in any case", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);

    const res = await send(app, token, message(from, { headers: { bcc: "victim@example.org", "X-Ok": "1" } }));

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().code, "ATL_RESERVED_HEADER");
    assert.match(res.json().message, /bcc/);
  });

  it("enforces address, recipient, body and size limits", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);
    const many = (n: number) => Array.from({ length: n }, (_, i) => `user${i}@example.org`);

    const badAddress = await send(app, token, message(from, { to: ["not-an-address"] }));
    const group = await send(app, token, message(from, { to: ["list: a@example.org;"] }));
    const tooMany = await send(app, token, message(from, { to: many(30), cc: many(21) }));
    const noBody = await send(app, token, { from, to: ["a@example.org"], subject: "Hi" });
    const huge = await send(app, token, message(from, { html: "x".repeat(6 * 1024 * 1024) }));
    const badTag = await send(app, token, message(from, { tags: [{ name: "has space", value: "x" }] }));

    assert.equal(badAddress.json().code, "ATL_INVALID_ADDRESS");
    assert.equal(group.json().code, "ATL_INVALID_ADDRESS");
    assert.equal(tooMany.json().code, "ATL_TOO_MANY_RECIPIENTS");
    assert.equal(noBody.json().code, "ATL_BODY_REQUIRED");
    assert.equal(huge.statusCode, 413);
    assert.equal(badTag.statusCode, 400);
  });

  it("validates the Idempotency-Key header", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);

    const res = await send(app, token, message(from), { "idempotency-key": "x".repeat(256) });

    assert.equal(res.statusCode, 400);
  });
});

describe("GET /service/web/emails/:id", { skip: !hasDatabase }, () => {
  it("shows why the last attempt failed", async () => {
    const app = await buildTestApp();
    const { token, from } = await sender(app);
    const { id } = (await send(app, token, message(from))).json();
    await app.db
      .update(schema.emails)
      .set({ status: "failed", lastError: "ATL_PROVIDER_REJECTED: MessageRejected" })
      .where(eq(schema.emails.id, id));

    const got = (await app.inject({ method: "GET", url: `${url}/${id}`, headers: auth(token) })).json();

    assert.equal(got.status, "failed");
    assert.equal(got.lastError, "ATL_PROVIDER_REJECTED: MessageRejected");
  });

  it("returns 404 for another organization's email and for unknown ids", async () => {
    const app = await buildTestApp();
    const first = await sender(app);
    const second = await sender(app);
    const { id } = (await send(app, first.token, message(first.from))).json();

    const crossOrg = await app.inject({ method: "GET", url: `${url}/${id}`, headers: auth(second.token) });
    const unknown = await app.inject({ method: "GET", url: `${url}/${uuidv7()}`, headers: auth(first.token) });
    const invalid = await app.inject({ method: "GET", url: `${url}/not-a-uuid`, headers: auth(first.token) });

    assert.equal(crossOrg.statusCode, 404);
    assert.equal(unknown.statusCode, 404);
    assert.equal(invalid.statusCode, 400);
  });
});
