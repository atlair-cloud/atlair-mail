import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.ts";
import { migrate } from "../src/migrate.ts";

const url = process.env.DATABASE_URL;

test("migrate applies cleanly and re-runs as a no-op", { skip: !url }, async () => {
  const { db, close } = createDb(url as string);
  try {
    await migrate(db);
    const countApplied = async () => {
      const rows = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
      return Number(rows[0]?.n);
    };
    const first = await countApplied();
    await migrate(db);
    assert.equal(await countApplied(), first);
  } finally {
    await close();
  }
});
