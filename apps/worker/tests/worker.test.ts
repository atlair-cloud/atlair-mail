import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import { claimDueEmails, schema } from "@atlair-mail/db";
import {
  ProviderRejectedError,
  ProviderThrottledError,
  ProviderTimeoutError,
  type EmailMessage,
} from "@atlair-mail/providers";
import { createFakeProvider } from "@atlair-mail/providers/testing";
import { maxAttempts } from "../src/settings.ts";
import { databaseUrl, startWorker, useWorkerTestDb, waitFor } from "./helpers.ts";

const isFinal = (status: string) => ["sent", "failed"].includes(status);

describe("worker", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  const settled = (ids: string[]) =>
    waitFor(async () => {
      const rows = await t.db.select().from(schema.emails).where(inArray(schema.emails.id, ids));
      return rows.every((row) => isFinal(row.status) || (row.status === "queued" && row.attemptCount > 0));
    });

  it("sends a queued email and records the provider message id", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    const fake = createFakeProvider();
    const worker = startWorker(t.db, async () => fake);

    await settled([id!]);
    await worker.stop();
    const email = await t.read(id!);
    const message = fake.calls.find((call) => call.operation === "send")!.args[0] as EmailMessage;

    assert.equal(email.status, "sent");
    assert.equal(email.providerMessageId, "fake-1");
    assert.ok(email.sentAt);
    assert.equal(email.lockedUntil, null);
    assert.deepEqual(message.from, { name: "Acme", address: `hello@${from.domain}` });
    assert.deepEqual(message.to, [{ name: "Ada", address: "ada@example.org" }]);
    assert.deepEqual(message.cc, [{ address: "grace@example.org" }]);
    assert.deepEqual(message.tags, [{ name: "atlair_email_id", value: id }]);
  });

  it("fails permanently rejected emails without retrying", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    const fake = createFakeProvider({
      send: async () => {
        throw new ProviderRejectedError("MessageRejected");
      },
    });
    const worker = startWorker(t.db, async () => fake);

    await settled([id!]);
    await worker.stop();

    assert.deepEqual([(await t.read(id!)).status, (await t.read(id!)).lastError], ["failed", "ATL_PROVIDER_REJECTED"]);
    assert.equal(fake.calls.filter((call) => call.operation === "send").length, 1);
  });

  it("requeues transient failures with backoff and fails after the last attempt", async () => {
    const from = await t.sender();
    const [retryId] = await t.queue(from);
    const [lastId] = await t.queue(from, 1, { attemptCount: maxAttempts - 1 });
    const fake = createFakeProvider({
      send: async () => {
        throw new ProviderThrottledError();
      },
    });
    const worker = startWorker(t.db, async () => fake);

    await settled([retryId!, lastId!]);
    await worker.stop();
    const retried = await t.read(retryId!);
    const exhausted = await t.read(lastId!);

    assert.equal(retried.status, "queued");
    assert.equal(retried.attemptCount, 1);
    assert.equal(retried.lastError, "ATL_PROVIDER_THROTTLED");
    assert.ok(retried.sendAt.getTime() > Date.now() + 20_000);
    assert.equal(exhausted.status, "failed");
    assert.equal(exhausted.attemptCount, maxAttempts);
  });

  it("never resends when the outcome is unknown", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    const fake = createFakeProvider({
      send: async () => {
        throw new ProviderTimeoutError();
      },
    });
    const worker = startWorker(t.db, async () => fake);

    await settled([id!]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await worker.stop();

    assert.deepEqual([(await t.read(id!)).status, (await t.read(id!)).lastError], ["failed", "ATL_PROVIDER_TIMEOUT"]);
    assert.equal(fake.calls.filter((call) => call.operation === "send").length, 1);
  });
});

describe("worker pre-send checks", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  it("fails without sending when the provider, domain or recipients are no longer valid", async () => {
    const disconnected = await t.sender();
    const unverified = await t.sender("pending");
    const suppressedSender = await t.sender();
    await t.db
      .insert(schema.suppressedAddresses)
      .values({ organizationId: suppressedSender.organizationId, address: "grace@example.org", reason: "complaint" });
    const [noProvider] = await t.queue(disconnected);
    const [noDomain] = await t.queue(unverified);
    const [suppressed] = await t.queue(suppressedSender);
    const fake = createFakeProvider();
    const worker = startWorker(t.db, async (organizationId) =>
      organizationId === disconnected.organizationId ? null : fake,
    );

    await waitFor(async () => {
      const rows = await Promise.all([noProvider!, noDomain!, suppressed!].map((id) => t.read(id)));
      return rows.every((row) => row.status === "failed");
    });
    await worker.stop();

    assert.equal((await t.read(noProvider!)).lastError, "ATL_PROVIDER_NOT_CONNECTED");
    assert.equal((await t.read(noDomain!)).lastError, "ATL_DOMAIN_NOT_VERIFIED");
    assert.equal((await t.read(suppressed!)).lastError, "ATL_RECIPIENT_SUPPRESSED");
    assert.equal(fake.calls.filter((call) => call.operation === "send").length, 0);
  });
});

describe("worker concurrency and recovery", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  it("two workers send every email exactly once", async () => {
    const from = await t.sender();
    const ids = await t.queue(from, 30);
    const fake = createFakeProvider();
    const first = startWorker(t.db, async () => fake, 4);
    const second = startWorker(t.db, async () => fake, 4);

    await waitFor(async () => {
      const rows = await t.db.select().from(schema.emails).where(inArray(schema.emails.id, ids));
      return rows.every((row) => row.status === "sent");
    }, 10_000);
    await Promise.all([first.stop(), second.stop()]);
    const sentIds = fake.calls
      .filter((call) => call.operation === "send")
      .map((call) => (call.args[0] as EmailMessage).tags!.find((tag) => tag.name === "atlair_email_id")!.value);

    assert.equal(sentIds.length, 30);
    assert.equal(new Set(sentIds).size, 30);
    assert.deepEqual(new Set(sentIds), new Set(ids));
  });

  it("fails emails left mid-send by a crashed worker instead of resending them", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    await claimDueEmails(t.db, { limit: 1_000, leaseSeconds: 120 });
    await t.db
      .update(schema.emails)
      .set({ lockedUntil: sql`now() - interval '1 second'` })
      .where(eq(schema.emails.id, id!));
    const fake = createFakeProvider();
    const worker = startWorker(t.db, async () => fake);

    await waitFor(async () => (await t.read(id!)).status === "failed");
    await worker.stop();

    assert.equal((await t.read(id!)).lastError, "ATL_WORKER_LEASE_EXPIRED");
    assert.equal(fake.calls.length, 0);
  });

  it("finishes in-flight sends before stopping", async () => {
    const from = await t.sender();
    const [id] = await t.queue(from);
    const { promise: sendStarted, resolve: markStarted } = Promise.withResolvers<void>();
    const { promise: sendReleased, resolve: release } = Promise.withResolvers<void>();
    const fake = createFakeProvider({
      send: async () => {
        markStarted();
        await sendReleased;
        return { providerMessageId: "slow-1" };
      },
    });
    const worker = startWorker(t.db, async () => fake);

    await sendStarted;
    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(stopped, false);
    assert.equal((await t.read(id!)).status, "sending");
    release();
    await stopping;
    assert.equal((await t.read(id!)).status, "sent");
  });
});
