import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { createDb } from "../src/client.ts";

const url = process.env.DATABASE_URL;

test("createDb connects and runs select 1", { skip: !url }, async () => {
  const { db, close } = createDb(url as string);
  try {
    const rows = await db.execute(sql`select 1 as ok`);
    assert.equal(Number(rows[0]?.ok), 1);
  } finally {
    await close();
  }
});
