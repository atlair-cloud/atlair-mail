import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { TemplateDocument, TemplateTheme, VariableDefinition } from "@atlair-mail/templates/document";
import { id, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";
import { apiKeys } from "./api-keys.ts";
import { userId } from "./auth.ts";

export const templateAliasPattern = "^[a-z0-9][a-z0-9-]{0,62}$";

export const maxVersionNoteLength = 500;

export const templates = pgTable(
  "templates",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    alias: text("alias"),
    subject: text("subject").notNull(),
    content: jsonb("content").$type<TemplateDocument>().notNull(),
    theme: jsonb("theme").$type<TemplateTheme>().notNull().default({}),
    variables: jsonb("variables").$type<VariableDefinition[]>().notNull().default([]),
    revision: integer("revision").notNull().default(1),
    latestVersion: integer("latest_version").notNull().default(0),
    publishedVersion: integer("published_version"),
    publishedRevision: integer("published_revision"),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("templates_organization_id_name_unique").on(t.organizationId, t.name),
    uniqueIndex("templates_organization_id_alias_unique").on(t.organizationId, t.alias),
    check("templates_name_check", sql`char_length(${t.name}) between 1 and 100`),
    check("templates_alias_check", sql`${t.alias} ~ '${sql.raw(templateAliasPattern)}'`),
    check("templates_revision_check", sql`${t.revision} >= 1`),
    check("templates_latest_version_check", sql`${t.latestVersion} >= 0`),
    check(
      "templates_published_version_check",
      sql`${t.publishedVersion} is null or ${t.publishedVersion} between 1 and ${t.latestVersion}`,
    ),
    check(
      "templates_published_revision_check",
      sql`(${t.publishedVersion} is null) = (${t.publishedRevision} is null) and (${t.publishedRevision} is null or ${t.publishedRevision} between 1 and ${t.revision})`,
    ),
    check("templates_content_check", sql`jsonb_typeof(${t.content}) = 'object'`),
    check("templates_theme_check", sql`jsonb_typeof(${t.theme}) = 'object'`),
    check("templates_variables_check", sql`jsonb_typeof(${t.variables}) = 'array'`),
  ],
);

export const templateVersions = pgTable(
  "template_versions",
  {
    id: id(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    organizationId: organizationId(),
    number: integer("number").notNull(),
    subject: text("subject").notNull(),
    content: jsonb("content").$type<TemplateDocument>().notNull(),
    theme: jsonb("theme").$type<TemplateTheme>().notNull(),
    variables: jsonb("variables").$type<VariableDefinition[]>().notNull(),
    note: text("note"),
    publishedBy: userId("published_by"),
    publishedByApiKeyId: uuid("published_by_api_key_id").references((): AnyPgColumn => apiKeys.id, { onDelete: "set null" }),
    publishedAt: timestamptz("published_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("template_versions_template_id_number_unique").on(t.templateId, t.number),
    check("template_versions_number_check", sql`${t.number} >= 1`),
    check("template_versions_note_check", sql`char_length(${t.note}) between 1 and ${sql.raw(String(maxVersionNoteLength))}`),
    check("template_versions_content_check", sql`jsonb_typeof(${t.content}) = 'object'`),
    check("template_versions_theme_check", sql`jsonb_typeof(${t.theme}) = 'object'`),
    check("template_versions_variables_check", sql`jsonb_typeof(${t.variables}) = 'array'`),
  ],
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;
