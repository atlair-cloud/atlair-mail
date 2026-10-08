import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { domains, emailEvents, emails, type NewEmail } from "../src/schema/index.ts";
import type { ProviderEventPayload } from "../src/types.ts";
import {
  CHECK_VIOLATION,
  databaseUrl,
  FOREIGN_KEY_VIOLATION,
  newEmail,
  pgError,
  UNIQUE_VIOLATION,
  useTestDb,
} from "./helpers.ts";

const payload: ProviderEventPayload = {
  eventType: "Delivery",
  mail: { messageId: "ses-1", timestamp: new Date().toISOString(), destination: ["a@b.c"] },
};

describe("domains, emails, and email_events", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("a domain name is unique per organization, not globally", async () => {
    const first = await t.newOrganization();
    const second = await t.newOrganization();
    const name = `${uuidv7()}.example.com`;
    await t.newDomain(first.id, name);

    await assert.rejects(t.newDomain(first.id, name), pgError(UNIQUE_VIOLATION));
    await t.newDomain(second.id, name);
  });

  test("rejects a domain name that is not lowercase", async () => {
    const organization = await t.newOrganization();
    await assert.rejects(t.newDomain(organization.id, "Mail.Example.com"), pgError(CHECK_VIOLATION));
  });

  test("an email starts queued and due now", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const [email] = await t.db.insert(emails).values(newEmail(organization.id, domain.id)).returning();

    assert.equal(email?.status, "queued");
    assert.equal(email?.attemptCount, 0);
    assert.ok(email && email.sendAt.getTime() <= Date.now());
  });

  test("rejects an email with no recipient, no body, or an unknown status", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const insert = (overrides: Partial<NewEmail>) =>
      t.db.insert(emails).values(newEmail(organization.id, domain.id, overrides));

    await assert.rejects(insert({ toAddresses: [] }), pgError(CHECK_VIOLATION));
    await assert.rejects(insert({ textBody: null }), pgError(CHECK_VIOLATION));
    await assert.rejects(
      insert({ status: "lost" as NewEmail["status"] }),
      pgError(CHECK_VIOLATION),
    );
  });

  test("an idempotency key is unique per organization and optional", async () => {
    const first = await t.newOrganization();
    const second = await t.newOrganization();
    const firstDomain = await t.newDomain(first.id);
    const secondDomain = await t.newDomain(second.id);
    const idempotencyKey = uuidv7();

    await t.db.insert(emails).values(newEmail(first.id, firstDomain.id, { idempotencyKey, requestFingerprint: "f" }));
    await assert.rejects(
      t.db.insert(emails).values(newEmail(first.id, firstDomain.id, { idempotencyKey, requestFingerprint: "f" })),
      pgError(UNIQUE_VIOLATION),
    );
    await t.db.insert(emails).values(newEmail(second.id, secondDomain.id, { idempotencyKey, requestFingerprint: "f" }));
    await t.db
      .insert(emails)
      .values([newEmail(first.id, firstDomain.id), newEmail(first.id, firstDomain.id)]);
  });

  test("refuses to delete a domain that emails were sent from", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    await t.db.insert(emails).values(newEmail(organization.id, domain.id));

    await assert.rejects(
      t.db.delete(domains).where(eq(domains.id, domain.id)),
      pgError(FOREIGN_KEY_VIOLATION),
    );
  });

  test("the worker's claim query uses the partial queued index", async () => {
    await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const rows = await tx.execute(sql`
        explain select ${emails.id} from ${emails}
        where ${emails.status} = 'queued' and ${emails.sendAt} <= now()
        order by ${emails.sendAt}
        limit 10
        for update skip locked
      `);
      const plan = rows.map((row) => String(row["QUERY PLAN"])).join("\n");
      assert.match(plan, /emails_send_at_queued_idx/);
    });
  });

  test("rejects a duplicate provider event and removes events with their email", async () => {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const [email] = await t.db.insert(emails).values(newEmail(organization.id, domain.id)).returning();
    assert.ok(email);
    const event = {
      emailId: email.id,
      type: "delivered" as const,
      providerEventId: uuidv7(),
      occurredAt: new Date(),
      payload,
    };

    await t.db.insert(emailEvents).values(event);
    await assert.rejects(t.db.insert(emailEvents).values(event), pgError(UNIQUE_VIOLATION));

    await t.db.delete(emails).where(eq(emails.id, email.id));
    const remaining = await t.db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.providerEventId, event.providerEventId));
    assert.equal(remaining.length, 0);
  });
});
