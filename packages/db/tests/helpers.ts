import { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { inArray } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import { createDb, type Database, type Db } from "../src/client.ts";
import { migrate } from "../src/migrate.ts";
import {
  apiKeys,
  domains,
  emails,
  organizations,
  sesConnections,
  suppressedAddresses,
  webhookEndpoints,
  type NewApiKey,
  type NewEmail,
} from "../src/schema/index.ts";

export const databaseUrl = process.env.DATABASE_URL;

export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
export const CHECK_VIOLATION = "23514";

export const pgError = (code: string) => (error: unknown) =>
  error instanceof DrizzleQueryError &&
  error.cause instanceof postgres.PostgresError &&
  error.cause.code === code;

async function deleteOrganizations(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(webhookEndpoints).where(inArray(webhookEndpoints.organizationId, ids));
  await db.delete(suppressedAddresses).where(inArray(suppressedAddresses.organizationId, ids));
  await db.delete(emails).where(inArray(emails.organizationId, ids));
  await db.delete(domains).where(inArray(domains.organizationId, ids));
  await db.delete(sesConnections).where(inArray(sesConnections.organizationId, ids));
  await db.delete(apiKeys).where(inArray(apiKeys.organizationId, ids));
  await db.delete(organizations).where(inArray(organizations.id, ids));
}

export function useTestDb() {
  let conn: Db;
  const organizationIds: string[] = [];

  before(async () => {
    conn = createDb(databaseUrl as string);
    await migrate(conn.db);
  });

  after(async () => {
    await deleteOrganizations(conn.db, organizationIds);
    await conn.close();
  });

  const newOrganization = async () => {
    const [organization] = await conn.db
      .insert(organizations)
      .values({ name: "Acme" })
      .returning();
    assert.ok(organization);
    organizationIds.push(organization.id);
    return organization;
  };

  const newDomain = async (organizationId: string, name = `${uuidv7()}.example.com`) => {
    const [domain] = await conn.db.insert(domains).values({ organizationId, name }).returning();
    assert.ok(domain);
    return domain;
  };

  return {
    get db() {
      return conn.db;
    },
    newOrganization,
    newDomain,
  };
}

export const newKey = (organizationId: string, overrides: Partial<NewApiKey> = {}): NewApiKey => {
  const token = `am_${randomBytes(32).toString("base64url")}`;
  return {
    organizationId,
    name: "Production",
    tokenHash: createHash("sha256").update(token).digest("hex"),
    tokenPrefix: token.slice(0, 7),
    ...overrides,
  };
};

export const newEmail = (
  organizationId: string,
  domainId: string,
  overrides: Partial<NewEmail> = {},
): NewEmail => ({
  organizationId,
  domainId,
  fromAddress: "hello@example.com",
  toAddresses: ["user@example.org"],
  subject: "Hello",
  textBody: "Hi there",
  ...overrides,
});
