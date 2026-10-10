import { bigint, boolean, index, integer, pgSchema, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, timestamptz } from "./_columns.ts";

export const authSchema = pgSchema("auth");

export const users = authSchema.table(
  "user",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_email_unique").on(t.email)],
);

export const sessions = authSchema.table(
  "session",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_token_unique").on(t.token), index("session_user_id_idx").on(t.userId)],
);

export const accounts = authSchema.table(
  "account",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("account_provider_id_account_id_unique").on(t.providerId, t.accountId),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const verifications = authSchema.table(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimits = authSchema.table(
  "rate_limit",
  {
    id: id(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("rate_limit_key_unique").on(t.key)],
);

export const userId = (name: string) => uuid(name).references(() => users.id, { onDelete: "set null" });

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
