import { after, before } from "node:test";
import { eq, inArray } from "drizzle-orm";
import pino from "pino";
import { v7 as uuidv7 } from "uuid";
import { createDb, migrate, schema, type Db } from "@atlair-mail/db";
import type { EmailProvider } from "@atlair-mail/providers";
import { createWorker } from "../src/worker.ts";

export const databaseUrl = process.env.DATABASE_URL;

export function useWorkerTestDb() {
  let conn: Db;
  const organizationIds: string[] = [];

  before(async () => {
    conn = createDb(databaseUrl as string);
    await migrate(databaseUrl as string);
  });

  after(async () => {
    if (organizationIds.length > 0) {
      const ids = organizationIds;
      await conn.db.delete(schema.webhookEndpoints).where(inArray(schema.webhookEndpoints.organizationId, ids));
      await conn.db.delete(schema.suppressedAddresses).where(inArray(schema.suppressedAddresses.organizationId, ids));
      await conn.db.delete(schema.emails).where(inArray(schema.emails.organizationId, ids));
      await conn.db.delete(schema.domains).where(inArray(schema.domains.organizationId, ids));
      await conn.db.delete(schema.providerConnections).where(inArray(schema.providerConnections.organizationId, ids));
      await conn.db.delete(schema.organizations).where(inArray(schema.organizations.id, ids));
    }
    await conn.close();
  });

  async function sender(status: "verified" | "pending" = "verified") {
    const [organization] = await conn.db.insert(schema.organizations).values({ name: "Worker test" }).returning();
    organizationIds.push(organization!.id);
    const name = `${uuidv7()}.example.com`;
    const [domain] = await conn.db
      .insert(schema.domains)
      .values({ organizationId: organization!.id, name, status })
      .returning();
    return { organizationId: organization!.id, domainId: domain!.id, domain: name };
  }

  async function queue(
    from: Awaited<ReturnType<typeof sender>>,
    count = 1,
    overrides: Partial<typeof schema.emails.$inferInsert> = {},
  ) {
    const rows = await conn.db
      .insert(schema.emails)
      .values(
        Array.from({ length: count }, () => ({
          organizationId: from.organizationId,
          domainId: from.domainId,
          fromAddress: `"Acme" <hello@${from.domain}>`,
          toAddresses: ['"Ada" <ada@example.org>'],
          ccAddresses: ["grace@example.org"],
          subject: "Welcome",
          textBody: "Hi",
          ...overrides,
        })),
      )
      .returning();
    return rows.map((row) => row.id);
  }

  const read = async (id: string) =>
    (await conn.db.select().from(schema.emails).where(eq(schema.emails.id, id)))[0]!;

  return {
    get db() {
      return conn.db;
    },
    sender,
    queue,
    read,
  };
}

export const silentLogger = pino({ level: "silent" });

export function startWorker(
  db: Db["db"],
  loadProvider: (organizationId: string) => Promise<EmailProvider | null>,
  concurrency = 5,
) {
  const worker = createWorker({ db, logger: silentLogger, concurrency, loadProvider, idle: { minMs: 20, maxMs: 50 } });
  worker.start();
  return worker;
}

export async function waitFor(condition: () => Promise<boolean>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for condition");
}
