import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as runMigrations } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrate(url: string): Promise<void> {
  const connection = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await connection`select pg_advisory_lock(hashtext('atlair-mail:migrate'))`;
    await runMigrations(drizzle(connection), { migrationsFolder });
  } finally {
    await connection.end({ timeout: 5 });
  }
}
