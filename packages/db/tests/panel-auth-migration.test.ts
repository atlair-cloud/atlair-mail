import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate as runMigrations } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrate } from "../src/migrate.ts";
import { organizationSlugPattern } from "../src/schema/organizations.ts";

const url = process.env.DATABASE_URL;
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

async function migrationsBefore(tag: string) {
  const folder = await mkdtemp(join(tmpdir(), "atlair-mail-migrations-"));
  await cp(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  const cut = journal.entries.findIndex((entry: { tag: string }) => entry.tag === tag);
  journal.entries = journal.entries.slice(0, cut);
  await writeFile(journalPath, JSON.stringify(journal));
  return folder;
}

test("0014 backfills unique slugs and seeds roles for existing organizations", { skip: !url }, async () => {
  const name = `atlair_mail_backfill_${process.pid}_${Date.now()}`;
  const admin = postgres(url as string, { max: 1, onnotice: () => {} });
  const target = new URL(url as string);
  target.pathname = `/${name}`;
  const folder = await migrationsBefore("0014_panel_auth");
  await admin.unsafe(`create database ${name}`);
  const client = postgres(target.toString(), { max: 1, onnotice: () => {} });

  try {
    await runMigrations(drizzle(client), { migrationsFolder: folder });
    await client`insert into organizations (id, name) values
      (gen_random_uuid(), 'Acme'),
      (gen_random_uuid(), 'Acme'),
      (gen_random_uuid(), '!!!'),
      (gen_random_uuid(), ${"Ünïcode & Spaces ".repeat(6)})`;

    await migrate(target.toString());

    const organizations = await client`select id, name, slug from organizations`;
    const roles = await client`select organization_id, name, permissions from roles order by name`;
    const slugs = organizations.map((organization) => organization.slug as string);

    assert.equal(new Set(slugs).size, 4);
    for (const slug of slugs) assert.match(slug, new RegExp(organizationSlugPattern));
    assert.ok(slugs.some((slug) => slug.startsWith("acme-")));
    assert.ok(slugs.some((slug) => slug.startsWith("org-")));
    assert.equal(roles.length, 12);
    assert.deepEqual([...new Set(roles.map((role) => role.name))], ["admin", "member", "owner"]);
    assert.ok(!roles.find((role) => role.name === "member")!.permissions.includes("audit:view"));
  } finally {
    await client.end({ timeout: 5 });
    await admin.unsafe(`drop database if exists ${name}`);
    await admin.end({ timeout: 5 });
    await rm(folder, { recursive: true, force: true });
  }
});
