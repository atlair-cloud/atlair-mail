import { sql } from "drizzle-orm";
import { integer, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());

export const createdAt = () => timestamptz("created_at").notNull().defaultNow();

export const updatedAt = () =>
  timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
};

export const encryptionKeyVersion = () => integer("encryption_key_version").notNull();

export const attemptCount = () => integer("attempt_count").notNull().default(0);

export const isOneOf = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} in (${sql.join(
    values.map((value) => sql.raw(`'${value}'`)),
    sql`, `,
  )})`;

export const isSubsetOf = (column: AnyPgColumn, values: readonly string[]) =>
  sql`${column} <@ array[${sql.join(
    values.map((value) => sql.raw(`'${value}'`)),
    sql`, `,
  )}]::text[]`;
