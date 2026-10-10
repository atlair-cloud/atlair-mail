import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { listenForWork, type WorkKind, type WorkListener } from "../src/notify.ts";
import { claimDueEmails, msUntilNextEmail, msUntilNextLeaseExpiry, requeueEmail } from "../src/repositories/email-queue.ts";
import { msUntilNextEventPoll } from "../src/repositories/provider-connections.ts";
import { emails, providerConnections } from "../src/schema/index.ts";
import { databaseUrl, newEmail, useTestDb } from "./helpers.ts";

describe("work notifications", { skip: !databaseUrl }, () => {
  const t = useTestDb();
  const received: WorkKind[] = [];
  let listener: WorkListener;

  before(async () => {
    listener = await listenForWork(databaseUrl!, { onWork: (kind) => received.push(kind), onListen: () => {} });
  });

  after(async () => {
    await listener.close();
  });

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return received.splice(0);
  }

  async function sender() {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    return { organizationId: organization.id, domainId: domain.id };
  }

  test("notifies once per transaction when queued emails are inserted", async () => {
    const from = await sender();
    await settle();

    await t.db.insert(emails).values([1, 2, 3].map(() => newEmail(from.organizationId, from.domainId)));

    assert.deepEqual(await settle(), ["email"]);
  });

  test("notifies for scheduled emails so the worker can wake on time", async () => {
    const from = await sender();
    await settle();

    await t.db.insert(emails).values(newEmail(from.organizationId, from.domainId, { sendAt: new Date(Date.now() + 60_000) }));

    assert.deepEqual(await settle(), ["email"]);
  });

  test("does not notify when the worker claims, so claims never wake the worker again", async () => {
    const from = await sender();
    await t.db.insert(emails).values(newEmail(from.organizationId, from.domainId));
    await settle();

    const claimed = await claimDueEmails(t.db, { limit: 100, leaseSeconds: 120 });

    assert.ok(claimed.length > 0);
    assert.deepEqual(await settle(), []);
  });

  test("notifies when an email is queued again for a retry", async () => {
    const from = await sender();
    const [row] = await t.db.insert(emails).values(newEmail(from.organizationId, from.domainId)).returning();
    await claimDueEmails(t.db, { limit: 100, leaseSeconds: 120 });
    await settle();

    await requeueEmail(t.db, row!.id, { sendAt: new Date(Date.now() + 30_000), lastError: "ATL_PROVIDER_THROTTLED" });

    assert.deepEqual(await settle(), ["email"]);
  });

  test("notifies when event polling is turned on, not on each poll", async () => {
    const from = await sender();
    const [connection] = await t.db
      .insert(providerConnections)
      .values({
        organizationId: from.organizationId,
        provider: "ses",
        settings: { region: "us-east-1", accessKeyId: "AKIAEXAMPLE" },
        credentialsEncrypted: "ciphertext",
        encryptionKeyVersion: 1,
      })
      .returning();
    await settle();

    await t.db.update(providerConnections).set({ eventsPollAfter: sql`now()` }).where(eq(providerConnections.id, connection!.id));
    assert.deepEqual(await settle(), ["events"]);

    await t.db
      .update(providerConnections)
      .set({ eventsPollAfter: sql`now() + interval '2 minutes'` })
      .where(eq(providerConnections.id, connection!.id));
    assert.deepEqual(await settle(), []);
    assert.ok((await msUntilNextEventPoll(t.db))! <= 120_000);

    await t.db.update(providerConnections).set({ eventsPollAfter: null }).where(eq(providerConnections.id, connection!.id));
  });

  test("reports how long until the next due email and lease expiry", async () => {
    const from = await sender();
    await t.db.insert(emails).values(newEmail(from.organizationId, from.domainId));

    assert.ok((await msUntilNextEmail(t.db))! <= 0);

    await claimDueEmails(t.db, { limit: 100, leaseSeconds: 120 });
    const untilExpiry = await msUntilNextLeaseExpiry(t.db);
    assert.ok(untilExpiry !== null && untilExpiry <= 120_000);
  });
});
