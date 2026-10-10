import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { templates, type NewTemplate } from "../schema/index.ts";
import type { Actor } from "../types.ts";
import { editorColumns } from "./actors.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

const inOrganization = (organizationId: string, idOrAlias: string) =>
  and(
    eq(templates.organizationId, organizationId),
    uuid.test(idOrAlias) ? eq(templates.id, idOrAlias) : eq(templates.alias, idOrAlias.toLowerCase()),
  );

export async function insertTemplate(db: Executor, values: NewTemplate) {
  const [template] = await db.insert(templates).values(values).returning();
  return template!;
}

export async function findTemplate(db: Executor, organizationId: string, idOrAlias: string) {
  const [template] = await db.select().from(templates).where(inOrganization(organizationId, idOrAlias)).limit(1);
  return template ?? null;
}

export interface TemplatePage {
  organizationId: string;
  search?: string;
  before?: string;
  limit: number;
}

export async function listTemplates(db: Executor, page: TemplatePage) {
  const pattern = page.search === undefined ? undefined : likePattern(page.search);
  return db
    .select({
      id: templates.id,
      name: templates.name,
      alias: templates.alias,
      subject: templates.subject,
      variables: templates.variables,
      version: templates.version,
      createdAt: templates.createdAt,
      createdBy: templates.createdBy,
      createdByApiKeyId: templates.createdByApiKeyId,
      updatedAt: templates.updatedAt,
      updatedBy: templates.updatedBy,
      updatedByApiKeyId: templates.updatedByApiKeyId,
    })
    .from(templates)
    .where(
      and(
        eq(templates.organizationId, page.organizationId),
        pattern === undefined ? undefined : or(ilike(templates.name, pattern), ilike(templates.alias, pattern)),
        page.before === undefined ? undefined : lt(templates.id, page.before),
      ),
    )
    .orderBy(desc(templates.id))
    .limit(page.limit);
}

export interface TemplateChanges {
  name?: string;
  alias?: string | null;
  subject?: string;
  content?: NewTemplate["content"];
  theme?: NewTemplate["theme"];
  variables?: NewTemplate["variables"];
}

export async function updateTemplate(
  db: Executor,
  organizationId: string,
  id: string,
  expectedVersion: number,
  changes: TemplateChanges,
  actor: Actor,
) {
  const [template] = await db
    .update(templates)
    .set({ ...changes, version: sql`${templates.version} + 1`, ...editorColumns(actor) })
    .where(and(eq(templates.organizationId, organizationId), eq(templates.id, id), eq(templates.version, expectedVersion)))
    .returning();
  return template ?? null;
}

export async function deleteTemplate(db: Executor, organizationId: string, id: string) {
  const [template] = await db
    .delete(templates)
    .where(and(eq(templates.organizationId, organizationId), eq(templates.id, id)))
    .returning({ id: templates.id });
  return template ?? null;
}
