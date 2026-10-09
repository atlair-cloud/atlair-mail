import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  claimDueEventPolls,
  deleteProviderConnection,
  finishEventPoll,
  findProviderConnectionById,
  findProviderConnectionByOrganization,
  markProviderEventsConfirmed,
  saveProviderEvents,
  stopEventPolling,
  upsertProviderConnection,
} from "../src/repositories/provider-connections.ts";
import { providerConnections } from "../src/schema/index.ts";
import { CHECK_VIOLATION, databaseUrl, pgError, useTestDb } from "./helpers.ts";

const connection = (organizationId: string, accessKeyId = "AKIAEXAMPLE000000001") => ({
  organizationId,
  provider: "ses" as const,
  settings: { region: "us-east-1", accessKeyId },
  credentialsEncrypted: "ciphertext",
  encryptionKeyVersion: 1,
});

describe("provider connection repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("upsert keeps one row per organization and updates it in place", async () => {
    const organization = await t.newOrganization();

    const created = await upsertProviderConnection(t.db, connection(organization.id));
    const updated = await upsertProviderConnection(t.db, connection(organization.id, "AKIAEXAMPLE000000002"));

    assert.equal(updated.id, created.id);
    assert.deepEqual(updated.settings, { region: "us-east-1", accessKeyId: "AKIAEXAMPLE000000002" });
    assert.ok(updated.updatedAt.getTime() >= created.updatedAt.getTime());
  });

  test("finds and deletes only within the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    await upsertProviderConnection(t.db, connection(organization.id));

    assert.equal(await findProviderConnectionByOrganization(t.db, other.id), null);
    assert.equal(await deleteProviderConnection(t.db, other.id), null);
    assert.ok(await findProviderConnectionByOrganization(t.db, organization.id));

    assert.ok(await deleteProviderConnection(t.db, organization.id));
    assert.equal(await findProviderConnectionByOrganization(t.db, organization.id), null);
  });

  test("rejects unknown providers and non-object settings", async () => {
    const organization = await t.newOrganization();

    await assert.rejects(
      t.db.insert(providerConnections).values({ ...connection(organization.id), provider: sql`'smtp'` as never }),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      t.db.insert(providerConnections).values({ ...connection(organization.id), settings: sql`'[]'::jsonb` as never }),
      pgError(CHECK_VIOLATION),
    );
  });

  test("events stay confirmed for the same URL and reset for a new URL or a replaced connection", async () => {
    const organization = await t.newOrganization();
    const created = await upsertProviderConnection(t.db, connection(organization.id));
    const settings = { region: "us-east-1", accessKeyId: "AKIAEXAMPLE000000001", eventTopicArn: "arn:topic" };
    const read = async () => (await findProviderConnectionById(t.db, created.id))!;

    assert.equal(await markProviderEventsConfirmed(t.db, created.id), null);
    await saveProviderEvents(t.db, created.id, { mode: "push", settings, eventsUrl: "https://a.example.com", active: false });
    await markProviderEventsConfirmed(t.db, created.id);
    const confirmed = await read();
    await saveProviderEvents(t.db, created.id, { mode: "push", settings, eventsUrl: "https://a.example.com", active: false });
    const sameUrl = await read();
    await saveProviderEvents(t.db, created.id, { mode: "push", settings, eventsUrl: "https://b.example.com", active: false });
    const newUrl = await read();
    await markProviderEventsConfirmed(t.db, created.id);
    await upsertProviderConnection(t.db, connection(organization.id, "AKIAEXAMPLE000000002"));
    const replaced = await read();

    assert.ok(confirmed.eventsConfirmedAt);
    assert.deepEqual(confirmed.settings, settings);
    assert.equal(sameUrl.eventsConfirmedAt?.getTime(), confirmed.eventsConfirmedAt.getTime());
    assert.equal(newUrl.eventsUrl, "https://b.example.com");
    assert.equal(newUrl.eventsConfirmedAt, null);
    assert.equal(replaced.eventsUrl, null);
    assert.equal(replaced.eventsConfirmedAt, null);
  });

  const pullSettings = {
    region: "us-east-1",
    accessKeyId: "AKIAEXAMPLE000000001",
    eventTopicArn: "arn:topic",
    eventQueueUrl: "https://sqs.us-east-1.amazonaws.com/1/q",
    eventDeadLetterQueueUrl: "https://sqs.us-east-1.amazonaws.com/1/q-dlq",
  };

  const pullConnection = async () => {
    const organization = await t.newOrganization();
    const created = await upsertProviderConnection(t.db, connection(organization.id));
    await saveProviderEvents(t.db, created.id, { mode: "pull", settings: pullSettings, active: true });
    return created.id;
  };

  const readById = async (id: string) => (await findProviderConnectionById(t.db, id))!;

  const makeDue = (id: string) =>
    t.db
      .update(providerConnections)
      .set({ eventsPollAfter: sql`now() - interval '1 second'` })
      .where(eq(providerConnections.id, id));

  const claimOwn = async (id: string, leaseUntil = new Date(Date.now() + 60_000)) =>
    (await claimDueEventPolls(t.db, { limit: 1000, leaseUntil })).find((row) => row.id === id);

  test("pull mode is active at once and starts polling; switching to push keeps draining the queue", async () => {
    const id = await pullConnection();
    const pulled = await readById(id);

    await saveProviderEvents(t.db, id, {
      mode: "push",
      settings: pullSettings,
      eventsUrl: "https://a.example.com",
      active: false,
    });
    const switched = await readById(id);
    await upsertProviderConnection(t.db, connection(pulled.organizationId, "AKIAEXAMPLE000000003"));
    const replaced = await readById(id);

    assert.equal(pulled.eventsMode, "pull");
    assert.equal(pulled.eventsUrl, null);
    assert.ok(pulled.eventsConfirmedAt);
    assert.ok(pulled.eventsPollAfter);
    assert.equal(switched.eventsMode, "push");
    assert.equal(switched.eventsConfirmedAt, null);
    assert.equal(switched.eventsPollAfter?.getTime(), pulled.eventsPollAfter.getTime());
    assert.equal(replaced.eventsMode, null);
    assert.equal(replaced.eventsPollAfter, null);
  });

  test("the mode and URL must agree", async () => {
    const id = await pullConnection();

    await assert.rejects(
      t.db.update(providerConnections).set({ eventsUrl: "https://a.example.com" }).where(eq(providerConnections.id, id)),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      t.db.update(providerConnections).set({ eventsMode: "push" }).where(eq(providerConnections.id, id)),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      t.db.update(providerConnections).set({ eventsMode: sql`'smoke'` as never }).where(eq(providerConnections.id, id)),
      pgError(CHECK_VIOLATION),
    );
  });

  test("only one worker holds a connection's poll lease, and only the holder can record the result", async () => {
    const id = await pullConnection();
    await makeDue(id);

    const [first, second] = await Promise.all([claimOwn(id), claimOwn(id)]);
    const holder = first ?? second;
    assert.ok(holder);
    assert.ok(!(first && second));
    assert.equal(await claimOwn(id), undefined);

    const stale = await finishEventPoll(t.db, {
      id,
      leaseUntil: new Date(0),
      received: 0,
      error: null,
      nextPollAt: new Date(),
    });
    const failed = await finishEventPoll(t.db, {
      id,
      leaseUntil: holder.eventsPollAfter!,
      received: 0,
      error: "ATL_PROVIDER_REJECTED: AccessDenied",
      nextPollAt: new Date(Date.now() + 60_000),
    });
    const afterFailure = await readById(id);

    assert.equal(stale, null);
    assert.deepEqual(failed, { id, eventsFailures: 1 });
    assert.equal(afterFailure.eventsLastError, "ATL_PROVIDER_REJECTED: AccessDenied");
    assert.equal(await claimOwn(id), undefined);

    await makeDue(id);
    const again = await claimOwn(id);
    await finishEventPoll(t.db, {
      id,
      leaseUntil: again!.eventsPollAfter!,
      received: 3,
      error: null,
      nextPollAt: new Date(),
      stats: { backlog: 4, deadLetters: 1 },
    });
    const recovered = await readById(id);

    assert.equal(recovered.eventsFailures, 0);
    assert.equal(recovered.eventsLastError, null);
    assert.ok(recovered.eventsLastReceivedAt);
    assert.equal(recovered.eventsBacklog, 4);
    assert.equal(recovered.eventsDeadLetters, 1);
  });

  test("a lease taken by a replaced connection cannot be written back, and polling can stop", async () => {
    const id = await pullConnection();
    await makeDue(id);
    const claimed = await claimOwn(id);
    const organizationId = claimed!.organizationId;

    await upsertProviderConnection(t.db, connection(organizationId, "AKIAEXAMPLE000000004"));
    const late = await finishEventPoll(t.db, {
      id,
      leaseUntil: claimed!.eventsPollAfter!,
      received: 1,
      error: null,
      nextPollAt: new Date(),
    });

    assert.equal(late, null);
    assert.equal((await readById(id)).eventsPollAfter, null);

    const other = await pullConnection();
    await stopEventPolling(t.db, other);
    assert.equal((await readById(other)).eventsPollAfter, null);
  });

  test("cannot be confirmed while events are disabled", async () => {
    const organization = await t.newOrganization();
    await upsertProviderConnection(t.db, connection(organization.id));

    await assert.rejects(
      t.db.execute(
        sql`update provider_connections set events_confirmed_at = now() where organization_id = ${organization.id}`,
      ),
      pgError(CHECK_VIOLATION),
    );
  });
});
