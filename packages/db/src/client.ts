import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

export interface Db {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDb(url: string): Db {
  const client = postgres(url, { max: 10, connect_timeout: 5 });
  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

export async function ping(db: Executor): Promise<void> {
  await db.execute(sql`select 1`);
}
