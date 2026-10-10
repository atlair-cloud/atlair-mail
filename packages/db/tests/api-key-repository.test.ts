import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import {
  findApiKeyInOrganization,
  insertApiKey,
  listApiKeysByOrganization,
  revokeApiKey,
  touchApiKeyLastUsed,
} from "../src/repositories/api-keys.ts";
import { apiKeys } from "../src/schema/index.ts";
import { databaseUrl, newKey, system, useTestDb } from "./helpers.ts";

describe("api key lifecycle repositories", { skip: !databaseUrl }, () => {
  const t = useTestDb();

  test("lists only the organization's keys, newest first", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const older = await insertApiKey(t.db, newKey(organization.id, { name: "Older" }));
    const newer = await insertApiKey(t.db, newKey(organization.id, { name: "Newer" }));
    await insertApiKey(t.db, newKey(other.id));

    const keys = await listApiKeysByOrganization(t.db, organization.id);

    assert.deepEqual(
      keys.map((key) => key.id),
      [newer.id, older.id],
    );
  });

  test("finds and revokes a key only within its organization", async () => {
    const organization = await t.newOrganization();
    const other = await t.newOrganization();
    const key = await insertApiKey(t.db, newKey(organization.id));
    const elsewhere = { id: key.id, organizationId: other.id };

    assert.equal(await findApiKeyInOrganization(t.db, elsewhere), null);
    assert.equal(await revokeApiKey(t.db, elsewhere, system), null);

    const revoked = await revokeApiKey(t.db, { id: key.id, organizationId: organization.id }, system);
    assert.ok(revoked?.revokedAt);
    assert.equal(await revokeApiKey(t.db, { id: key.id, organizationId: organization.id }, system), null);
  });

  test("touchApiKeyLastUsed writes at most once a minute and leaves updated_at alone", async () => {
    const organization = await t.newOrganization();
    const key = await insertApiKey(t.db, newKey(organization.id));
    const read = async () =>
      (await t.db.select().from(apiKeys).where(eq(apiKeys.id, key.id)))[0]!;

    await touchApiKeyLastUsed(t.db, key.id);
    const first = await read();
    assert.ok(first.lastUsedAt);
    assert.equal(first.updatedAt.getTime(), key.updatedAt.getTime());

    await touchApiKeyLastUsed(t.db, key.id);
    assert.equal((await read()).lastUsedAt?.getTime(), first.lastUsedAt.getTime());

    await t.db
      .update(apiKeys)
      .set({ lastUsedAt: sql`now() - interval '2 minutes'` })
      .where(eq(apiKeys.id, key.id));
    const stale = (await read()).lastUsedAt!;
    await touchApiKeyLastUsed(t.db, key.id);
    assert.ok((await read()).lastUsedAt!.getTime() - stale.getTime() >= 60_000);
  });
});
