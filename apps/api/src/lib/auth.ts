import type { FastifyBaseLogger } from "fastify";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { v7 as uuidv7 } from "uuid";
import { insertAuditLog, schema, type Database } from "@atlair-mail/db";
import type { Env } from "../env.ts";

export const authBasePath = "/api/auth";
export const clientIpHeader = "x-atlair-mail-client-ip";

const day = 60 * 60 * 24;

export interface PanelAuthSettings {
  secret: string;
  baseURL: string;
  panelOrigins: string[];
  signupDisabled: boolean;
  github: { clientId: string; clientSecret: string } | null;
  google: { clientId: string; clientSecret: string } | null;
}

const provider = (clientId: string, clientSecret: string) =>
  clientId !== "" && clientSecret !== "" ? { clientId, clientSecret } : null;

export function panelAuthSettings(env: Env): PanelAuthSettings | null {
  if (env.BETTER_AUTH_SECRET === "") return null;
  if (env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)");
  }
  if (env.BETTER_AUTH_URL === "") throw new Error("BETTER_AUTH_URL is required when BETTER_AUTH_SECRET is set");
  const panelOrigins = env.PANEL_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  if (panelOrigins.length === 0) throw new Error("PANEL_ORIGINS is required when BETTER_AUTH_SECRET is set");
  for (const origin of panelOrigins) {
    if (new URL(origin).origin !== origin) throw new Error(`PANEL_ORIGINS entry ${origin} must be an origin like https://mail.example.com`);
  }
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    panelOrigins,
    signupDisabled: env.AUTH_SIGNUP === "disabled",
    github: provider(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
    google: provider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  };
}

export function createAuth(db: Database, settings: PanelAuthSettings, log: FastifyBaseLogger) {
  const audit = (action: string, entityType: string, entityId: string, actorUserId: string) =>
    insertAuditLog(db, { action, entityType, entityId, actorUserId });

  return betterAuth({
    appName: "atlair-mail",
    logger: {
      log: (level, message, ...args) => log[level]({ args }, message),
    },
    secret: settings.secret,
    baseURL: settings.baseURL,
    basePath: authBasePath,
    trustedOrigins: settings.panelOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      disableSignUp: settings.signupDisabled,
    },
    socialProviders: {
      ...(settings.github && { github: { ...settings.github, disableSignUp: settings.signupDisabled } }),
      ...(settings.google && { google: { ...settings.google, disableSignUp: settings.signupDisabled } }),
    },
    session: {
      expiresIn: 7 * day,
      updateAge: day,
      freshAge: 60 * 60,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },
    account: {
      encryptOAuthTokens: true,
    },
    advanced: {
      cookiePrefix: "atlair-mail",
      useSecureCookies: settings.baseURL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: [clientIpHeader] },
      database: { generateId: () => uuidv7() },
    },
    databaseHooks: {
      user: {
        create: { after: async (user) => audit("user.signed_up", "user", user.id, user.id) },
      },
      session: {
        create: { after: async (session) => audit("session.created", "session", session.id, session.userId) },
      },
      account: {
        create: { after: async (account) => audit("account.linked", "account", account.id, account.userId) },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth["$Infer"]["Session"]["user"];
export type AuthSession = Auth["$Infer"]["Session"]["session"];
