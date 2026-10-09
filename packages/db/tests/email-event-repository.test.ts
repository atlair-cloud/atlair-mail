import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  advanceEmailStatus,
  insertEmailEvent,
  listEmailEvents,
  listOutcomeEvents,
  lockEmailForEvent,
} from "../src/repositories/email-events.ts";
import { emails, type NewEmail } from "../src/schema/index.ts";
import type { EmailStatus } from "../src/types.ts";
import { databaseUrl, newEmail, useTestDb } from "./helpers.ts";

describe("email event repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  async function email(overrides: Partial<NewEmail> = {}) {
    const organization = await t.newOrganization();
    const domain = await t.newDomain(organization.id);
    const [row] = await t.db
      .insert(emails)
      .values(newEmail(organization.id, domain.id, { status: "sent", providerMessageId: uuidv7(), ...overrides }))
      .returning();
    assert.ok(row);
    return row;
  }

  const read = async (id: string) => (await t.db.select().from(emails).where(eq(emails.id, id)))[0]!;

  const event = (emailId: string, providerEventId = uuidv7()) => ({
    emailId,
    type: "delivered" as const,
    providerEventId,
    occurredAt: new Date(),
    payload: { recipients: [{ address: "user@example.org" }] },
  });

  const change = (id: string, status: EmailStatus, from: EmailStatus[], providerMessageId = "msg-1") => ({
    id,
    status,
    from,
    providerMessageId,
    occurredAt: new Date("2026-10-09T10:00:00.000Z"),
    lastError: null,
  });

  test("finds an email by provider message id only inside its organization", async () => {
    const sent = await email();
    const other = await t.newOrganization();

    const found = await lockEmailForEvent(t.db, {
      organizationId: sent.organizationId,
      providerMessageId: sent.providerMessageId!,
    });
    const foreign = await lockEmailForEvent(t.db, {
      organizationId: other.id,
      providerMessageId: sent.providerMessageId!,
      emailId: sent.id,
    });

    assert.deepEqual(found, { id: sent.id, status: "sent" });
    assert.equal(foreign, null);
  });

  test("falls back to the email id tag only while the provider message id is unknown", async () => {
    const pending = await email({ status: "sending", providerMessageId: null });
    const confirmed = await email();
    const target = (emailId: string, organizationId: string) => ({
      organizationId,
      providerMessageId: uuidv7(),
      emailId,
    });

    assert.deepEqual(await lockEmailForEvent(t.db, target(pending.id, pending.organizationId)), {
      id: pending.id,
      status: "sending",
    });
    assert.equal(await lockEmailForEvent(t.db, target(confirmed.id, confirmed.organizationId)), null);
    assert.equal(await lockEmailForEvent(t.db, target("not-a-uuid", pending.organizationId)), null);
  });

  test("stores an event once per email", async () => {
    const sent = await email();
    const other = await email();
    const key = uuidv7();

    const first = await insertEmailEvent(t.db, event(sent.id, key));
    const repeat = await insertEmailEvent(t.db, event(sent.id, key));
    const elsewhere = await insertEmailEvent(t.db, event(other.id, key));

    assert.ok(first);
    assert.equal(repeat, null);
    assert.ok(elsewhere);
    assert.equal((await listEmailEvents(t.db, { emailId: sent.id, organizationId: sent.organizationId })).length, 1);
  });

  test("lists events only for the owning organization, oldest first", async () => {
    const sent = await email();
    const other = await t.newOrganization();
    await insertEmailEvent(t.db, { ...event(sent.id), occurredAt: new Date("2026-10-09T10:00:02Z") });
    await insertEmailEvent(t.db, { ...event(sent.id), type: "sent", occurredAt: new Date("2026-10-09T10:00:01Z") });

    const events = await listEmailEvents(t.db, { emailId: sent.id, organizationId: sent.organizationId });
    const foreign = await listEmailEvents(t.db, { emailId: sent.id, organizationId: other.id });

    assert.deepEqual(
      events.map((row) => row.type),
      ["sent", "delivered"],
    );
    assert.deepEqual(events[0]?.details, { recipients: [{ address: "user@example.org" }] });
    assert.equal(foreign.length, 0);
  });

  test("advances only from an allowed status", async () => {
    const sent = await email();

    assert.equal(await advanceEmailStatus(t.db, change(sent.id, "delivered", ["sending"])), null);
    assert.equal(await advanceEmailStatus(t.db, change(sent.id, "delivered", [])), null);
    assert.deepEqual(await advanceEmailStatus(t.db, change(sent.id, "delivered", ["sent"])), {
      id: sent.id,
      status: "delivered",
    });
  });

  test("settles an email the worker never confirmed and keeps known values", async () => {
    const expired = await email({
      status: "failed",
      providerMessageId: null,
      lastError: "ATL_WORKER_LEASE_EXPIRED",
    });
    const sent = await email({ sentAt: new Date("2026-10-09T09:00:00.000Z") });

    await advanceEmailStatus(t.db, change(expired.id, "delivered", ["failed"], "msg-expired"));
    await advanceEmailStatus(t.db, change(sent.id, "bounced", ["sent"], "msg-other"));

    const settled = await read(expired.id);
    assert.equal(settled.status, "delivered");
    assert.equal(settled.providerMessageId, "msg-expired");
    assert.equal(settled.sentAt?.toISOString(), "2026-10-09T10:00:00.000Z");
    assert.equal(settled.lastError, null);
    const bounced = await read(sent.id);
    assert.equal(bounced.providerMessageId, sent.providerMessageId);
    assert.equal(bounced.sentAt?.toISOString(), "2026-10-09T09:00:00.000Z");
  });

  test("a rejection records the error without a sent time", async () => {
    const sending = await email({ status: "sending", providerMessageId: null });

    await advanceEmailStatus(t.db, {
      ...change(sending.id, "failed", ["sending"]),
      lastError: "ATL_PROVIDER_REJECTED",
    });

    const failed = await read(sending.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.lastError, "ATL_PROVIDER_REJECTED");
    assert.equal(failed.sentAt, null);
  });

  test("a concurrent update re-checks the status after the other commits", async () => {
    const forward = await email();
    const backward = await email();
    const raced = (id: string, first: EmailStatus, second: EmailStatus, secondFrom: EmailStatus[]) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const holder = t.db.transaction(async (tx) => {
        await advanceEmailStatus(tx, change(id, first, ["sent"]));
        await gate;
      });
      const waiter = (async () => {
        await delay(50);
        const pending = advanceEmailStatus(t.db, change(id, second, secondFrom));
        await delay(100);
        release();
        return pending;
      })();
      return Promise.all([holder, waiter]).then(([, result]) => result);
    };

    const applied = await raced(forward.id, "delivered", "complained", ["sent", "delivered"]);
    const skipped = await raced(backward.id, "complained", "delivered", ["sent"]);

    assert.deepEqual(applied, { id: forward.id, status: "complained" });
    assert.equal(skipped, null);
    assert.equal((await read(backward.id)).status, "complained");
  });

  test("a second event for the same email waits for the first and then sees it", async () => {
    const sent = await email();
    const target = { organizationId: sent.organizationId, providerMessageId: sent.providerMessageId! };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let secondLocked = false;

    const first = t.db.transaction(async (tx) => {
      await lockEmailForEvent(tx, target);
      await insertEmailEvent(tx, { ...event(sent.id), type: "bounced" });
      await gate;
    });
    await delay(50);
    const second = t.db.transaction(async (tx) => {
      await lockEmailForEvent(tx, target);
      secondLocked = true;
      return listOutcomeEvents(tx, sent.id);
    });
    await delay(100);
    const lockedWhileFirstOpen = secondLocked;
    release();
    const [, seen] = await Promise.all([first, second]);

    assert.equal(lockedWhileFirstOpen, false);
    assert.deepEqual(
      seen.map((row) => row.type),
      ["bounced"],
    );
  });

  test("outcome events leave out delays and engagement", async () => {
    const sent = await email();
    for (const type of ["sent", "delivery_delayed", "opened", "clicked", "delivered"] as const) {
      await insertEmailEvent(t.db, { ...event(sent.id), type });
    }

    const rows = await listOutcomeEvents(t.db, sent.id);

    assert.deepEqual(rows.map((row) => row.type).sort(), ["delivered", "sent"]);
  });
});
