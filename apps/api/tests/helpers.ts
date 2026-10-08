import { after } from "node:test";
import { eq } from "drizzle-orm";
import { migrate, schema, type ApiKeyPermission } from "@atlair-mail/db";
import { buildApp, type BuildAppOptions } from "../src/app.ts";
import type { Env } from "../src/env.ts";
import { generateApiKeyToken } from "../src/lib/api-key-tokens.ts";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const UNREACHABLE_DATABASE_URL = "postgres://atlair:atlair@127.0.0.1:1/atlair_mail";

export const TEST_ROOT_KEY = "am_root_test_key";

export const TEST_CREDENTIALS_ENCRYPTION_KEYS = `1:${Buffer.alloc(32, 7).toString("base64")}`;

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

type TestApp = Awaited<ReturnType<typeof buildApp>>;

const cleanups = new WeakMap<TestApp, (() => Promise<unknown>)[]>();

export async function buildTestApp(env: Partial<Env> = {}, opts: Omit<BuildAppOptions, "env"> = {}) {
  const app = await buildApp({
    ...opts,
    env: {
      LOG_LEVEL: "silent",
      ROOT_API_KEY: TEST_ROOT_KEY,
      CREDENTIALS_ENCRYPTION_KEYS: TEST_CREDENTIALS_ENCRYPTION_KEYS,
      ...env,
    },
  });
  await app.ready();
  cleanups.set(app, []);
  after(async () => {
    for (const cleanup of cleanups.get(app)!.reverse()) await cleanup();
    await app.close();
  });
  return app;
}

export async function buildMigratedTestApp(env: Partial<Env> = {}) {
  const app = await buildTestApp(env);
  await migrate(app.config.DATABASE_URL);
  return app;
}

export function deleteOrganizationAfterTest(app: TestApp, organizationId: string) {
  cleanups.get(app)!.push(async () => {
    await app.db.delete(schema.sesConnections).where(eq(schema.sesConnections.organizationId, organizationId));
    await app.db.delete(schema.apiKeys).where(eq(schema.apiKeys.organizationId, organizationId));
    await app.db.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
  });
}

export async function createTestKey(
  app: TestApp,
  opts: { permission?: ApiKeyPermission; revoked?: boolean } = {},
) {
  await migrate(app.config.DATABASE_URL);
  const [organization] = await app.db
    .insert(schema.organizations)
    .values({ name: "Test" })
    .returning();
  deleteOrganizationAfterTest(app, organization!.id);

  const { token, tokenHash, tokenPrefix } = generateApiKeyToken();
  const [key] = await app.db
    .insert(schema.apiKeys)
    .values({
      organizationId: organization!.id,
      name: "Test",
      permission: opts.permission,
      tokenHash,
      tokenPrefix,
      revokedAt: opts.revoked ? new Date() : null,
    })
    .returning();

  return { token, keyId: key!.id, organizationId: organization!.id };
}
