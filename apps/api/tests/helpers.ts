import { after } from "node:test";
import { and, eq, isNull } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
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
    await app.db.delete(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.organizationId, organizationId));
    await app.db.delete(schema.suppressedAddresses).where(eq(schema.suppressedAddresses.organizationId, organizationId));
    await app.db.delete(schema.emails).where(eq(schema.emails.organizationId, organizationId));
    await app.db.delete(schema.domains).where(eq(schema.domains.organizationId, organizationId));
    await app.db.delete(schema.providerConnections).where(eq(schema.providerConnections.organizationId, organizationId));
    await app.db.delete(schema.apiKeys).where(eq(schema.apiKeys.organizationId, organizationId));
    await app.db.delete(schema.auditLogs).where(eq(schema.auditLogs.organizationId, organizationId));
    await app.db.delete(schema.members).where(eq(schema.members.organizationId, organizationId));
    await app.db.delete(schema.roles).where(eq(schema.roles.organizationId, organizationId));
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

export const PANEL_ORIGIN = "https://panel.example.test";

export const panelEnv = {
  BETTER_AUTH_SECRET: "panel-test-secret-that-is-long-enough-for-better-auth",
  BETTER_AUTH_URL: "http://localhost",
  PANEL_ORIGINS: PANEL_ORIGIN,
} satisfies Partial<Env>;

export async function buildPanelTestApp(env: Partial<Env> = {}) {
  return buildMigratedTestApp({ ...panelEnv, ...env });
}

const octet = () => 1 + Math.floor(Math.random() * 254);

export const randomIp = () => `10.${octet()}.${octet()}.${octet()}`;

export function deleteUserAfterTest(app: TestApp, userId: string) {
  cleanups.get(app)!.push(async () => {
    await app.db
      .delete(schema.auditLogs)
      .where(and(eq(schema.auditLogs.actorUserId, userId), isNull(schema.auditLogs.organizationId)));
    await app.db.delete(schema.users).where(eq(schema.users.id, userId));
  });
}

export interface PanelUser {
  id: string;
  email: string;
  password: string;
  headers: { cookie: string; origin: string };
}

export async function signUp(app: TestApp, name = "Panel User"): Promise<PanelUser> {
  const email = `${uuidv7()}@example.test`;
  const password = "correct horse battery staple";
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    remoteAddress: randomIp(),
    headers: { origin: PANEL_ORIGIN },
    payload: { name, email, password },
  });
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`);
  const id = res.json().user.id as string;
  deleteUserAfterTest(app, id);
  const cookie = res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { id, email, password, headers: { cookie, origin: PANEL_ORIGIN } };
}

export async function createPanelOrganization(app: TestApp, owner: PanelUser, name = "Acme") {
  const res = await app.inject({
    method: "POST",
    url: "/service/panel/organizations",
    headers: owner.headers,
    payload: { name },
  });
  if (res.statusCode !== 201) throw new Error(`create organization failed: ${res.statusCode} ${res.body}`);
  const organization = res.json() as { id: string; slug: string; name: string; role: string };
  deleteOrganizationAfterTest(app, organization.id);
  return organization;
}

export async function addPanelMember(
  app: TestApp,
  owner: PanelUser,
  organizationId: string,
  member: PanelUser,
  role: "admin" | "member",
) {
  const res = await app.inject({
    method: "POST",
    url: `/service/panel/organizations/${organizationId}/members`,
    headers: owner.headers,
    payload: { email: member.email, role },
  });
  if (res.statusCode !== 201) throw new Error(`add member failed: ${res.statusCode} ${res.body}`);
  return res.json() as { id: string; role: string };
}
