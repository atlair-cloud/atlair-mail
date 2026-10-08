import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import {
  claimDueEmails,
  failExpiredLeases,
  markEmailFailed,
  markEmailSent,
  requeueEmail,
} from "../src/repositories/email-queue.ts";
import { emails } from "../src/schema/index.ts";
import { databaseUrl, newEmail, useTestDb } from "./helpers.ts";

const lease = { leaseSeconds: 120 };

describe("email queue repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  async function queued(count: number, overrides: Parameters<typeof newEmail>[2] = {}) {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const rows = await t.db
      .insert(emails)
      .values(Array.from({ length: count }, () => newEmail(organization.id, domain.id, overrides)))
      .returning();
    return rows.map((row) => row.id);
  }

  const read = async (id: string) => (await t.db.select().from(emails).where(eq(emails.id, id)))[0]!;

  test("concurrent claims never hand out the same email twice", async () => {
    const ids = await queued(20);

    const batches = await Promise.all(
      Array.from({ length: 4 }, () => claimDueEmails(t.db, { limit: 10, ...lease })),
    );
    const claimed = batches.flat().map((row) => row.id).filter((id) => ids.includes(id));

    assert.equal(claimed.length, 20);
    assert.equal(new Set(claimed).size, 20);
    const rows = await t.db.select().from(emails).where(inArray(emails.id, ids));
    assert.ok(rows.every((row) => row.status === "sending" && row.attemptCount === 1 && row.lockedUntil));
  });

  test("does not claim emails scheduled for later or not queued", async () => {
    const [later] = await queued(1, { sendAt: new Date(Date.now() + 3_600_000) });
    const [canceled] = await queued(1, { status: "canceled" });

    const claimed = (await claimDueEmails(t.db, { limit: 100, ...lease })).map((row) => row.id);

    assert.ok(!claimed.includes(later!));
    assert.ok(!claimed.includes(canceled!));
  });

  test("outcomes only apply to emails that are still sending", async () => {
    const [sentId, requeuedId, failedId] = await queued(3);
    await claimDueEmails(t.db, { limit: 100, ...lease });
    const retryAt = new Date(Date.now() + 30_000);

    assert.ok(await markEmailSent(t.db, sentId!, "provider-1"));
    assert.ok(await requeueEmail(t.db, requeuedId!, { sendAt: retryAt, lastError: "ATL_PROVIDER_THROTTLED" }));
    assert.ok(await markEmailFailed(t.db, failedId!, "ATL_PROVIDER_REJECTED"));
    assert.equal(await markEmailFailed(t.db, sentId!, "late"), null);
    assert.equal(await markEmailSent(t.db, failedId!, "provider-2"), null);

    const [sent, requeued, failed] = await Promise.all([read(sentId!), read(requeuedId!), read(failedId!)]);
    assert.deepEqual([sent.status, sent.providerMessageId, sent.lockedUntil], ["sent", "provider-1", null]);
    assert.ok(sent.sentAt);
    assert.deepEqual([requeued.status, requeued.lastError, requeued.lockedUntil], ["queued", "ATL_PROVIDER_THROTTLED", null]);
    assert.equal(requeued.sendAt.getTime(), retryAt.getTime());
    assert.deepEqual([failed.status, failed.lastError], ["failed", "ATL_PROVIDER_REJECTED"]);
  });

  test("the sweeper fails only sending emails whose lease expired", async () => {
    const [expiredId, activeId] = await queued(2);
    await claimDueEmails(t.db, { limit: 100, ...lease });
    await t.db.update(emails).set({ lockedUntil: sql`now() - interval '1 second'` }).where(eq(emails.id, expiredId!));

    const swept = (await failExpiredLeases(t.db, "ATL_WORKER_LEASE_EXPIRED")).map((row) => row.id);

    assert.ok(swept.includes(expiredId!));
    assert.ok(!swept.includes(activeId!));
    assert.equal((await read(expiredId!)).status, "failed");
    assert.equal((await read(activeId!)).status, "sending");
  });

  test("the sweeper uses the partial sending index", async () => {
    await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const rows = await tx.execute(sql`
        explain select ${emails.id} from ${emails}
        where ${emails.status} = 'sending' and ${emails.lockedUntil} < now()
      `);
      const plan = rows.map((row) => String(row["QUERY PLAN"])).join("\n");
      assert.match(plan, /emails_locked_until_sending_idx/);
    });
  });
});
