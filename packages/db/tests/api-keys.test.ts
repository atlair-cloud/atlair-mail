import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { findActiveApiKeyByTokenHash } from "../src/repositories/api-keys.ts";
import { apiKeys, organizations, type NewApiKey } from "../src/schema/index.ts";
import {
  CHECK_VIOLATION,
  databaseUrl,
  FOREIGN_KEY_VIOLATION,
  newKey,
  pgError,
  UNIQUE_VIOLATION,
  useTestDb,
} from "./helpers.ts";

describe("organizations and api_keys", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("an api key resolves to its organization by token hash", async () => {
    const organization = await t.newOrganization();
    const key = newKey(organization.id);
    await t.db.insert(apiKeys).values(key);

    const [row] = await t.db
      .select({ organizationId: apiKeys.organizationId, permission: apiKeys.permission })
      .from(apiKeys)
      .where(eq(apiKeys.tokenHash, key.tokenHash));

    assert.deepEqual(row, { organizationId: organization.id, permission: "full_access" });
  });

  test("ids are generated as UUIDv7", async () => {
    const organization = await t.newOrganization();
    assert.equal(organization.id[14], "7");
  });

  test("rejects a duplicate token hash", async () => {
    const organization = await t.newOrganization();
    const key = newKey(organization.id);
    await t.db.insert(apiKeys).values(key);

    await assert.rejects(
      t.db.insert(apiKeys).values({ ...key, name: "Copy" }),
      pgError(UNIQUE_VIOLATION),
    );
  });

  test("rejects a key for an unknown organization", async () => {
    await assert.rejects(
      t.db.insert(apiKeys).values(newKey(uuidv7())),
      pgError(FOREIGN_KEY_VIOLATION),
    );
  });

  test("refuses to delete an organization that still has keys", async () => {
    const organization = await t.newOrganization();
    await t.db.insert(apiKeys).values(newKey(organization.id));

    await assert.rejects(
      t.db.delete(organizations).where(eq(organizations.id, organization.id)),
      pgError(FOREIGN_KEY_VIOLATION),
    );
  });

  test("rejects an unknown permission and an out-of-range name", async () => {
    const organization = await t.newOrganization();

    await assert.rejects(
      t.db
        .insert(apiKeys)
        .values(newKey(organization.id, { permission: "admin" as NewApiKey["permission"] })),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      t.db.insert(apiKeys).values(newKey(organization.id, { name: "" })),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      t.db.insert(apiKeys).values(newKey(organization.id, { name: "x".repeat(51) })),
      pgError(CHECK_VIOLATION),
    );
  });

  test("last_used_at updates without touching the key's other columns", async () => {
    const organization = await t.newOrganization();
    const [before] = await t.db.insert(apiKeys).values(newKey(organization.id)).returning();
    assert.ok(before);

    const usedAt = new Date();
    const [after] = await t.db
      .update(apiKeys)
      .set({ lastUsedAt: usedAt })
      .where(eq(apiKeys.id, before.id))
      .returning();
    assert.ok(after);

    const { lastUsedAt, updatedAt, ...unchanged } = after;
    const { lastUsedAt: _l, updatedAt: _u, ...original } = before;
    assert.deepEqual(unchanged, original);
    assert.equal(lastUsedAt?.getTime(), usedAt.getTime());
  });

  test("findActiveApiKeyByTokenHash returns the key's organization and permission", async () => {
    const organization = await t.newOrganization();
    const key = newKey(organization.id, { permission: "sending_access" });
    const [inserted] = await t.db.insert(apiKeys).values(key).returning();

    assert.deepEqual(await findActiveApiKeyByTokenHash(t.db, key.tokenHash), {
      id: inserted?.id,
      organizationId: organization.id,
      permission: "sending_access",
    });
  });

  test("findActiveApiKeyByTokenHash ignores revoked and unknown keys", async () => {
    const organization = await t.newOrganization();
    const revoked = newKey(organization.id, { revokedAt: new Date() });
    await t.db.insert(apiKeys).values(revoked);

    assert.equal(await findActiveApiKeyByTokenHash(t.db, revoked.tokenHash), null);
    assert.equal(await findActiveApiKeyByTokenHash(t.db, "0".repeat(64)), null);
  });
});
