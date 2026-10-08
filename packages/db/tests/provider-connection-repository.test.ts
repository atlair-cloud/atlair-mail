import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import {
  deleteProviderConnection,
  findProviderConnectionByOrganization,
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
});
