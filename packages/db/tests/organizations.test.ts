import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { v7 as uuidv7 } from "uuid";
import { findActiveApiKeyByTokenHash, insertApiKey } from "../src/repositories/api-keys.ts";
import { findOrganizationById } from "../src/repositories/organizations.ts";
import { databaseUrl, newKey, useTestDb } from "./helpers.ts";

describe("organization and api key repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("findOrganizationById returns the organization or null", async () => {
    const organization = await t.newOrganization();

    assert.deepEqual(await findOrganizationById(t.db, organization.id), organization);
    assert.equal(await findOrganizationById(t.db, uuidv7()), null);
  });

  test("insertApiKey stores a key that resolves by its hash", async () => {
    const organization = await t.newOrganization();
    const values = newKey(organization.id);

    const key = await insertApiKey(t.db, values);

    assert.equal(key.organizationId, organization.id);
    assert.equal((await findActiveApiKeyByTokenHash(t.db, values.tokenHash))?.id, key.id);
  });
});
