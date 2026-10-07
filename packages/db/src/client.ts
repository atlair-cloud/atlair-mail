import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;

export interface Db {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDb(url: string): Db {
  const client = postgres(url, { max: 10 });
  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
