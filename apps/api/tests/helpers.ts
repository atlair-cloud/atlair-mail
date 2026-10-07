import { after } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate, schema, type ApiKeyPermission } from "@atlair-mail/db";
import { buildApp } from "../src/app.ts";
import type { Env } from "../src/env.ts";

/** Tests that touch Postgres skip unless DATABASE_URL is set (see compose.yaml). */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const UNREACHABLE_DATABASE_URL = "postgres://atlair:atlair@127.0.0.1:1/atlair_mail";

type TestApp = Awaited<ReturnType<typeof buildApp>>;

const cleanups = new WeakMap<TestApp, (() => Promise<unknown>)[]>();

/** Builds a ready app with quiet logs; seeded rows are removed and the app closed after the test. */
export async function buildTestApp(env: Partial<Env> = {}) {
  const app = await buildApp({ env: { LOG_LEVEL: "silent", ...env } });
  await app.ready();
  cleanups.set(app, []);
  after(async () => {
    for (const cleanup of cleanups.get(app)!.reverse()) await cleanup();
    await app.close();
  });
  return app;
}

/** Seeds an organization with one API key and returns the bearer token. */
export async function createTestKey(
  app: TestApp,
  opts: { permission?: ApiKeyPermission; revoked?: boolean } = {},
) {
  await migrate(app.config.DATABASE_URL);
  const [organization] = await app.db
    .insert(schema.organizations)
    .values({ name: "Test" })
    .returning();
  const token = `am_${randomBytes(32).toString("base64url")}`;
  const [key] = await app.db
    .insert(schema.apiKeys)
    .values({
      organizationId: organization!.id,
      name: "Test",
      permission: opts.permission,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      tokenPrefix: token.slice(0, 7),
      revokedAt: opts.revoked ? new Date() : null,
    })
    .returning();

  cleanups.get(app)!.push(async () => {
    await app.db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, key!.id));
    await app.db.delete(schema.organizations).where(eq(schema.organizations.id, organization!.id));
  });

  return { token, keyId: key!.id, organizationId: organization!.id };
}
