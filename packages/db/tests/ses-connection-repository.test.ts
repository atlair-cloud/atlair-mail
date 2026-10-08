import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  deleteSesConnection,
  findSesConnectionByOrganization,
  upsertSesConnection,
} from "../src/repositories/ses-connections.ts";
import { databaseUrl, useTestDb } from "./helpers.ts";

const connection = (organizationId: string, overrides: { accessKeyId?: string } = {}) => ({
  organizationId,
  region: "us-east-1",
  accessKeyId: overrides.accessKeyId ?? "AKIAEXAMPLE000000001",
  secretAccessKeyEncrypted: "ciphertext",
  encryptionKeyVersion: 1,
});

describe("ses connection repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("upsert keeps one row per organization and updates it in place", async () => {
    const organization = await t.newOrganization();

    const created = await upsertSesConnection(t.db, connection(organization.id));
    const updated = await upsertSesConnection(
      t.db,
      connection(organization.id, { accessKeyId: "AKIAEXAMPLE000000002" }),
    );

    assert.equal(updated.id, created.id);
    assert.equal(updated.accessKeyId, "AKIAEXAMPLE000000002");
    assert.equal(updated.configurationSet, null);
    assert.ok(updated.updatedAt.getTime() >= created.updatedAt.getTime());
  });

  test("finds and deletes only within the organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    await upsertSesConnection(t.db, connection(organization.id));

    assert.equal(await findSesConnectionByOrganization(t.db, other.id), null);
    assert.equal(await deleteSesConnection(t.db, other.id), null);
    assert.ok(await findSesConnectionByOrganization(t.db, organization.id));

    assert.ok(await deleteSesConnection(t.db, organization.id));
    assert.equal(await findSesConnectionByOrganization(t.db, organization.id), null);
  });
});
