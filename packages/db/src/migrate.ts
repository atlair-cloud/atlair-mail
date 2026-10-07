import { fileURLToPath } from "node:url";
import { migrate as runMigrations } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client.ts";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export function migrate(db: Database): Promise<void> {
  return runMigrations(db, { migrationsFolder });
}
