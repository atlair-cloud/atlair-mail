import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import {
  deleteProviderConnection,
  findProviderConnectionById,
  findProviderConnectionByOrganization,
  markProviderEventsConfirmed,
  saveProviderEvents,
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
    await saveProviderEvents(t.db, created.id, { settings, eventsUrl: "https://a.example.com" });
    await markProviderEventsConfirmed(t.db, created.id);
    const confirmed = await read();
    await saveProviderEvents(t.db, created.id, { settings, eventsUrl: "https://a.example.com" });
    const sameUrl = await read();
    await saveProviderEvents(t.db, created.id, { settings, eventsUrl: "https://b.example.com" });
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

  test("cannot be confirmed without an events URL", async () => {
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
