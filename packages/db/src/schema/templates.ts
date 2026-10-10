import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { TemplateDocument, TemplateTheme, VariableDefinition } from "@atlair-mail/templates/document";
import { id, timestamps } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";

export const templateAliasPattern = "^[a-z0-9][a-z0-9-]{0,62}$";

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
    version: integer("version").notNull().default(1),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("templates_organization_id_name_unique").on(t.organizationId, t.name),
    uniqueIndex("templates_organization_id_alias_unique").on(t.organizationId, t.alias),
    check("templates_name_check", sql`char_length(${t.name}) between 1 and 100`),
    check("templates_alias_check", sql`${t.alias} ~ '${sql.raw(templateAliasPattern)}'`),
    check("templates_version_check", sql`${t.version} >= 1`),
    check("templates_content_check", sql`jsonb_typeof(${t.content}) = 'object'`),
    check("templates_theme_check", sql`jsonb_typeof(${t.theme}) = 'object'`),
    check("templates_variables_check", sql`jsonb_typeof(${t.variables}) = 'array'`),
  ],
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
