import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { schema } from "@atlair-mail/db";
import { providerEventKey } from "@atlair-mail/providers";
import { auth, buildTestApp, createTestKey, hasDatabase } from "./helpers.ts";
import { maxWebhookEndpoints } from "../src/services/webhooks.ts";

const url = "/v1/webhooks";
type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

const create = (app: TestApp, token: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url, headers: auth(token), payload });

const hook = {
  url: "https://hooks.example.com/atlair?token=abc",
  eventTypes: ["email.delivered", "email.bounced", "email.failed"],
};

describe("/v1/webhooks", { skip: !hasDatabase }, () => {
  it("creates an endpoint and shows its signing secret only once, stored encrypted", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);

    const ok = await create(app, token, hook);
    const endpoint = ok.json();
    assert.equal(ok.statusCode, 201);
    assert.match(endpoint.signingSecret, /^whsec_[A-Za-z0-9+/]{43}=$/);
    assert.equal(endpoint.url, hook.url);
    assert.deepEqual(endpoint.eventTypes, hook.eventTypes);
    assert.equal(endpoint.enabled, true);

    const [stored] = await app.db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.id, endpoint.id));
    assert.notEqual(stored?.signingSecretEncrypted, endpoint.signingSecret);
    assert.ok(!stored?.signingSecretEncrypted.includes(endpoint.signingSecret.slice(6)));
    assert.equal(await app.credentialsCipher.decrypt(stored!.signingSecretEncrypted, organizationId), endpoint.signingSecret);
    const again = await app.inject({ method: "GET", url: `${url}/${endpoint.id}`, headers: auth(token) });
    assert.equal(again.json().signingSecret, undefined);
    assert.equal(
      JSON.stringify((await app.inject({ method: "GET", url, headers: auth(token) })).json()).includes("whsec_"),
      false,
    );
  });

  it("rejects private, insecure and malformed URLs and unknown event types", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);

    for (const target of [
      "http://hooks.example.com/in",
      "https://localhost/in",
      "https://127.0.0.1/in",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/in",
      "https://db.internal/in",
      "https://user:pass@hooks.example.com/in",
      "https://hooks.example.com/in#fragment",
    ]) {
      const response = await create(app, token, { ...hook, url: target });
      assert.equal(response.statusCode, 400, target);
    }
    for (const eventTypes of [[], ["delivered"], ["email.exploded"], ["email.sent", "email.sent"]]) {
      assert.equal((await create(app, token, { ...hook, eventTypes })).statusCode, 400, JSON.stringify(eventTypes));
    }
    const invalid = await create(app, token, { ...hook, url: "https://localhost/in" });
    assert.equal(invalid.json().code, "ATL_INVALID_WEBHOOK_URL");
  });

  it("updates, disables and deletes an endpoint", async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    const { id } = (await create(app, token, hook)).json();
    const patch = (payload: Record<string, unknown>) =>
      app.inject({ method: "PATCH", url: `${url}/${id}`, headers: auth(token), payload });

    const disabled = await patch({ enabled: false, eventTypes: ["email.complained"] });
    const moved = await patch({ url: "https://other.example.com/in" });
    const unchanged = await patch({});
    const rejected = await patch({ url: "https://10.0.0.1/in" });
    const removed = await app.inject({ method: "DELETE", url: `${url}/${id}`, headers: auth(token) });
    const removedAgain = await app.inject({ method: "DELETE", url: `${url}/${id}`, headers: auth(token) });

    assert.equal(disabled.json().enabled, false);
    assert.deepEqual(disabled.json().eventTypes, ["email.complained"]);
    assert.equal(moved.json().url, "https://other.example.com/in");
    assert.equal(moved.json().enabled, false);
    assert.equal(unchanged.statusCode, 200);
    assert.equal(rejected.statusCode, 400);
    assert.equal(removed.statusCode, 204);
    assert.equal(removedAgain.statusCode, 404);
  });

  it("keeps each organization's endpoints separate and requires a full_access key", async () => {
    const app = await buildTestApp();
    const owner = await createTestKey(app);
    const other = await createTestKey(app);
    const sending = await createTestKey(app, { permission: "sending_access" });
    const { id } = (await create(app, owner.token, hook)).json();

    for (const request of [
      { method: "GET" as const, url: `${url}/${id}` },
      { method: "PATCH" as const, url: `${url}/${id}`, payload: { enabled: false } },
      { method: "DELETE" as const, url: `${url}/${id}` },
      { method: "GET" as const, url: `${url}/${id}/deliveries` },
    ]) {
      assert.equal((await app.inject({ ...request, headers: auth(other.token) })).statusCode, 404, request.method);
    }
    assert.equal((await app.inject({ method: "GET", url, headers: auth(other.token) })).json().data.length, 0);
    assert.equal((await create(app, sending.token, hook)).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url, headers: auth(sending.token) })).statusCode, 403);
    assert.equal((await app.inject({ method: "GET", url: `${url}/${id}` })).statusCode, 401);
  });

  it(`allows at most ${maxWebhookEndpoints} endpoints per organization`, async () => {
    const app = await buildTestApp();
    const { token } = await createTestKey(app);
    for (let i = 0; i < maxWebhookEndpoints; i++) {
      assert.equal((await create(app, token, hook)).statusCode, 201);
    }

    const over = await create(app, token, hook);

    assert.equal(over.statusCode, 409);
    assert.equal(over.json().code, "ATL_WEBHOOK_LIMIT");
  });

  it("lists an endpoint's deliveries newest first", async () => {
    const app = await buildTestApp();
    const { token, organizationId } = await createTestKey(app);
    const { id } = (await create(app, token, hook)).json();
    const [domain] = await app.db
      .insert(schema.domains)
      .values({ organizationId, name: `${uuidv7()}.example.com`, status: "verified" })
      .returning();
    const providerMessageId = uuidv7();
    const [email] = await app.db
      .insert(schema.emails)
      .values({
        organizationId,
        domainId: domain!.id,
        fromAddress: `hello@${domain!.name}`,
        toAddresses: ["ada@example.org"],
        subject: "Hi",
        textBody: "Hi",
        status: "sent",
        providerMessageId,
      })
      .returning();
    for (const [type, second] of [
      ["delivered", 1],
      ["bounced", 2],
      ["opened", 3],
    ] as const) {
      const occurredAt = new Date(`2026-10-09T10:00:0${second}.000Z`);
      const recipients = [{ address: "ada@example.org" }];
      await app.services.emailEvents.record(organizationId, {
        eventKey: providerEventKey({ providerMessageId, type, occurredAt, recipients }),
        providerMessageId,
        type,
        occurredAt,
        details: { recipients, ...(type === "bounced" && { bounce: { kind: "transient", subType: "General" } }) },
      });
    }

    const first = await app.inject({ method: "GET", url: `${url}/${id}/deliveries?limit=1`, headers: auth(token) });
    const next = await app.inject({
      method: "GET",
      url: `${url}/${id}/deliveries?before=${first.json().data[0].id}`,
      headers: auth(token),
    });

    assert.equal(first.statusCode, 200);
    assert.equal(first.json().hasMore, true);
    assert.deepEqual(first.json().data[0], {
      ...first.json().data[0],
      eventType: "email.bounced",
      emailId: email!.id,
      status: "pending",
      attempts: 0,
      lastResponseStatus: null,
      lastError: null,
      deliveredAt: null,
    });
    assert.ok(first.json().data[0].nextAttemptAt);
    assert.deepEqual(
      next.json().data.map((delivery: { eventType: string }) => delivery.eventType),
      ["email.delivered"],
    );
    assert.equal(next.json().hasMore, false);
  });
});
