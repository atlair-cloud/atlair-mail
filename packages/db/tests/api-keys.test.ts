import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { createDb, type Db } from "../src/client.ts";
import { migrate } from "../src/migrate.ts";
import { apiKeys, organizations, type NewApiKey } from "../src/schema/index.ts";

const url = process.env.DATABASE_URL;

const pgError = (code: string) => (error: unknown) =>
  error instanceof DrizzleQueryError &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === code;

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

describe("organizations and api_keys", { skip: !url }, () => {
  let conn: Db;
  const organizationIds: string[] = [];

  const newOrganization = async () => {
    const [organization] = await conn.db
      .insert(organizations)
      .values({ name: "Acme" })
      .returning();
    assert.ok(organization);
    organizationIds.push(organization.id);
    return organization;
  };

  const newKey = (organizationId: string, overrides: Partial<NewApiKey> = {}): NewApiKey => {
    const token = `am_${randomBytes(32).toString("base64url")}`;
    return {
      organizationId,
      name: "Production",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenPrefix: token.slice(0, 7),
      ...overrides,
    };
  };

  before(async () => {
    conn = createDb(url as string);
    await migrate(conn.db);
  });

  after(async () => {
    if (organizationIds.length > 0) {
      await conn.db.delete(apiKeys).where(inArray(apiKeys.organizationId, organizationIds));
      await conn.db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
    await conn.close();
  });

  test("an api key resolves to its organization by token hash", async () => {
    const organization = await newOrganization();
    const key = newKey(organization.id);
    await conn.db.insert(apiKeys).values(key);

    const [row] = await conn.db
      .select({ organizationId: apiKeys.organizationId, permission: apiKeys.permission })
      .from(apiKeys)
      .where(eq(apiKeys.tokenHash, key.tokenHash));

    assert.deepEqual(row, { organizationId: organization.id, permission: "full_access" });
  });

  test("ids are generated as UUIDv7", async () => {
    const organization = await newOrganization();
    assert.equal(organization.id[14], "7");
  });

  test("rejects a duplicate token hash", async () => {
    const organization = await newOrganization();
    const key = newKey(organization.id);
    await conn.db.insert(apiKeys).values(key);

    await assert.rejects(
      conn.db.insert(apiKeys).values({ ...key, name: "Copy" }),
      pgError(UNIQUE_VIOLATION),
    );
  });

  test("rejects a key for an unknown organization", async () => {
    await assert.rejects(
      conn.db.insert(apiKeys).values(newKey(uuidv7())),
      pgError(FOREIGN_KEY_VIOLATION),
    );
  });

  test("refuses to delete an organization that still has keys", async () => {
    const organization = await newOrganization();
    await conn.db.insert(apiKeys).values(newKey(organization.id));

    await assert.rejects(
      conn.db.delete(organizations).where(eq(organizations.id, organization.id)),
      pgError(FOREIGN_KEY_VIOLATION),
    );
  });

  test("rejects an unknown permission and an out-of-range name", async () => {
    const organization = await newOrganization();

    await assert.rejects(
      conn.db
        .insert(apiKeys)
        .values(newKey(organization.id, { permission: "admin" as NewApiKey["permission"] })),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      conn.db.insert(apiKeys).values(newKey(organization.id, { name: "" })),
      pgError(CHECK_VIOLATION),
    );
    await assert.rejects(
      conn.db.insert(apiKeys).values(newKey(organization.id, { name: "x".repeat(51) })),
      pgError(CHECK_VIOLATION),
    );
  });

  test("last_used_at updates without touching the key's other columns", async () => {
    const organization = await newOrganization();
    const [before] = await conn.db.insert(apiKeys).values(newKey(organization.id)).returning();
    assert.ok(before);

    const usedAt = new Date();
    const [after] = await conn.db
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
});
