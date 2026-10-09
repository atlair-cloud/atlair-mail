import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import { claimDueEmails, schema, type EmailEventType } from "@atlair-mail/db";
import { ProviderRejectedError, ProviderThrottledError, ProviderTimeoutError, type EmailProvider } from "@atlair-mail/providers";
import { createFakeProvider } from "@atlair-mail/providers/testing";
import { failEmail } from "../src/email-failures.ts";
import { maxAttempts } from "../src/settings.ts";
import { databaseUrl, startWorker, useWorkerTestDb, waitFor } from "./helpers.ts";

const throwing = (error: Error) => createFakeProvider({ send: async () => Promise.reject(error) });

describe("failed email webhooks", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  const subscribe = async (organizationId: string, eventTypes: EmailEventType[] = ["failed"], disabled = false) => {
    const [endpoint] = await t.db
      .insert(schema.webhookEndpoints)
      .values({
        organizationId,
        url: "https://hooks.example.com/in",
        eventTypes,
        signingSecretEncrypted: "ciphertext",
        encryptionKeyVersion: 1,
        disabledAt: disabled ? new Date() : null,
      })
      .returning();
    return endpoint!;
  };

  const failedEvents = (emailId: string) =>
    t.db
      .select()
      .from(schema.emailEvents)
      .where(and(eq(schema.emailEvents.emailId, emailId), eq(schema.emailEvents.type, "failed")));

  const deliveriesFor = (endpointId: string) =>
    t.db.select().from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.webhookEndpointId, endpointId));

  it("emits one email.failed for every way the worker fails an email", async () => {
    const cases: {
      code: string;
      status?: "verified" | "pending";
      provider?: EmailProvider | null;
      overrides?: Partial<typeof schema.emails.$inferInsert>;
      suppress?: boolean;
    }[] = [
      { code: "ATL_PROVIDER_REJECTED: MessageRejected", provider: throwing(new ProviderRejectedError("MessageRejected")) },
      { code: "ATL_PROVIDER_TIMEOUT", provider: throwing(new ProviderTimeoutError()) },
      { code: "ATL_PROVIDER_NOT_CONNECTED", provider: null },
      { code: "ATL_DOMAIN_NOT_VERIFIED", status: "pending" },
      { code: "ATL_RECIPIENT_SUPPRESSED", suppress: true },
      { code: "ATL_INVALID_ADDRESS", overrides: { toAddresses: ["not an address"] } },
      {
        code: "ATL_PROVIDER_THROTTLED: Throttling",
        provider: throwing(new ProviderThrottledError({ reason: "Throttling" })),
        overrides: { attemptCount: maxAttempts - 1 },
      },
    ];
    const providers = new Map<string, EmailProvider | null>();
    const prepared: ((typeof cases)[number] & { id: string; endpoint: { id: string } })[] = [];
    for (const item of cases) {
      const from = await t.sender(item.status);
      const [id] = await t.queue(from, 1, { textBody: "secret body", ...item.overrides });
      const endpoint = await subscribe(from.organizationId);
      providers.set(from.organizationId, item.provider === undefined ? createFakeProvider() : item.provider);
      if (item.suppress) {
        await t.db
          .insert(schema.suppressedAddresses)
          .values({ organizationId: from.organizationId, address: "ada@example.org", reason: "manual" });
      }
      prepared.push({ ...item, id: id!, endpoint });
    }

    const worker = startWorker(t.db, async (organizationId) => providers.get(organizationId) ?? null);
    await waitFor(async () => {
      const rows = await t.db
        .select()
        .from(schema.emails)
        .where(inArray(schema.emails.id, prepared.map((item) => item.id)));
      return rows.every((row) => row.status === "failed");
    });
    await worker.stop();

    for (const item of prepared) {
      const events = await failedEvents(item.id);
      const deliveries = await deliveriesFor(item.endpoint.id);
      assert.equal(events.length, 1, item.code);
      assert.deepEqual(events[0]?.payload, { recipients: [], error: item.code });
      assert.equal(deliveries.length, 1, item.code);
      assert.equal(deliveries[0]?.payload.type, "email.failed");
      assert.equal(deliveries[0]?.payload.data.emailId, item.id);
      assert.equal(deliveries[0]?.payload.data.error, item.code);
      assert.ok(!JSON.stringify(deliveries[0]?.payload).includes("secret body"));
    }
  });

  it("emits email.failed when the sweeper fails an expired lease", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    const endpoint = await subscribe(from.organizationId);
    await claimDueEmails(t.db, { limit: 1000, leaseSeconds: 120 });
    await t.db.update(schema.emails).set({ lockedUntil: sql`now() - interval '1 second'` }).where(eq(schema.emails.id, id!));

    const worker = startWorker(t.db, async () => createFakeProvider());
    await waitFor(async () => (await t.read(id!)).status === "failed");
    await worker.stop();

    assert.equal((await failedEvents(id!)).length, 1);
    assert.equal((await deliveriesFor(endpoint.id))[0]?.payload.data.error, "ATL_WORKER_LEASE_EXPIRED");
  });

  it("emits nothing when the email already left sending", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from, 1, { status: "sent" });
    await subscribe(from.organizationId);

    assert.equal(await failEmail(t.db, id!, "ATL_PROVIDER_TIMEOUT"), null);
    assert.equal((await failedEvents(id!)).length, 0);
  });

  it("emits once even when two workers fail the same email", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from, 1, { status: "sending" });
    const endpoint = await subscribe(from.organizationId);

    const results = await Promise.all([
      failEmail(t.db, id!, "ATL_PROVIDER_TIMEOUT"),
      failEmail(t.db, id!, "ATL_WORKER_LEASE_EXPIRED"),
    ]);

    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await failedEvents(id!)).length, 1);
    assert.equal((await deliveriesFor(endpoint.id)).length, 1);
  });

  it("rolls back the status, event and deliveries together", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from, 1, { status: "sending" });
    const endpoint = await subscribe(from.organizationId);

    await assert.rejects(
      t.db.transaction(async (tx) => {
        assert.ok(await failEmail(tx, id!, "ATL_PROVIDER_TIMEOUT"));
        throw new Error("rollback");
      }),
      /rollback/,
    );

    assert.equal((await t.read(id!)).status, "sending");
    assert.equal((await failedEvents(id!)).length, 0);
    assert.equal((await deliveriesFor(endpoint.id)).length, 0);
  });

  it("skips disabled and unsubscribed endpoints", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from, 1, { status: "sending" });
    const disabled = await subscribe(from.organizationId, ["failed"], true);
    const unsubscribed = await subscribe(from.organizationId, ["delivered", "bounced"]);

    const result = await failEmail(t.db, id!, "ATL_PROVIDER_TIMEOUT");

    assert.deepEqual(result, { id, webhooks: 0 });
    assert.equal((await failedEvents(id!)).length, 1);
    assert.equal((await deliveriesFor(disabled.id)).length, 0);
    assert.equal((await deliveriesFor(unsubscribed.id)).length, 0);
  });
});
