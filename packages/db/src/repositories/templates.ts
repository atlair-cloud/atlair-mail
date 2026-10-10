import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { templates, templateVersions, type NewTemplate, type Template, type TemplateVersion } from "../schema/index.ts";
import type { Actor } from "../types.ts";
import { creatorColumns, editorColumns } from "./actors.ts";

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

export async function findTemplateHead(db: Executor, organizationId: string, idOrAlias: string) {
  const [template] = await db
    .select({ id: templates.id, revision: templates.revision, publishedVersion: templates.publishedVersion })
    .from(templates)
    .where(inOrganization(organizationId, idOrAlias))
    .limit(1);
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
      revision: templates.revision,
      latestVersion: templates.latestVersion,
      publishedVersion: templates.publishedVersion,
      publishedRevision: templates.publishedRevision,
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

export interface TemplateChanges extends PublishedSource {
  name?: string;
  alias?: string | null;
}

const matchesPublished = (source: PublishedSource) => sql`exists (
  select 1 from ${templateVersions}
  where ${templateVersions.templateId} = ${templates.id}
    and ${templateVersions.number} = ${templates.publishedVersion}
    and ${templateVersions.subject} = ${source.subject}
    and ${templateVersions.content} = ${JSON.stringify(source.content)}::jsonb
    and ${templateVersions.theme} = ${JSON.stringify(source.theme)}::jsonb
    and ${templateVersions.variables} = ${JSON.stringify(source.variables)}::jsonb
)`;

export async function updateTemplate(
  db: Executor,
  organizationId: string,
  id: string,
  expectedRevision: number,
  changes: TemplateChanges,
  actor: Actor,
) {
  const [template] = await db
    .update(templates)
    .set({
      ...changes,
      revision: sql`${templates.revision} + 1`,
      publishedRevision: sql`case when ${matchesPublished(changes)} then ${templates.revision} + 1 else ${templates.publishedRevision} end`,
      ...editorColumns(actor),
    })
    .where(and(eq(templates.organizationId, organizationId), eq(templates.id, id), eq(templates.revision, expectedRevision)))
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

export async function lockTemplate(db: Executor, organizationId: string, id: string) {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.organizationId, organizationId), eq(templates.id, id)))
    .for("update")
    .limit(1);
  return template ?? null;
}

const versionSummaryColumns = {
  id: templateVersions.id,
  number: templateVersions.number,
  subject: templateVersions.subject,
  note: templateVersions.note,
  publishedAt: templateVersions.publishedAt,
  publishedBy: templateVersions.publishedBy,
  publishedByApiKeyId: templateVersions.publishedByApiKeyId,
};

export interface PublishedSource {
  subject: string;
  content: TemplateVersion["content"];
  theme: TemplateVersion["theme"];
  variables: TemplateVersion["variables"];
}

export async function publishTemplateVersion(
  db: Executor,
  template: Pick<Template, "id" | "organizationId" | "latestVersion" | "revision">,
  source: PublishedSource,
  note: string | null,
  actor: Actor,
) {
  const number = template.latestVersion + 1;
  const author = creatorColumns(actor);
  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId: template.id,
      organizationId: template.organizationId,
      number,
      ...source,
      note,
      publishedBy: author.createdBy,
      publishedByApiKeyId: author.createdByApiKeyId,
    })
    .returning(versionSummaryColumns);
  const [published] = await db
    .update(templates)
    .set({ latestVersion: number, publishedVersion: number, publishedRevision: template.revision, ...editorColumns(actor) })
    .where(and(eq(templates.organizationId, template.organizationId), eq(templates.id, template.id)))
    .returning();
  return { version: version!, template: published! };
}

export interface TemplateVersionPage {
  organizationId: string;
  templateId: string;
  before?: number;
  limit: number;
}

export async function listTemplateVersions(db: Executor, page: TemplateVersionPage) {
  return db
    .select(versionSummaryColumns)
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.organizationId, page.organizationId),
        eq(templateVersions.templateId, page.templateId),
        page.before === undefined ? undefined : lt(templateVersions.number, page.before),
      ),
    )
    .orderBy(desc(templateVersions.number))
    .limit(page.limit);
}

export async function findTemplateVersion(db: Executor, organizationId: string, templateId: string, number: number) {
  const [version] = await db
    .select()
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.organizationId, organizationId),
        eq(templateVersions.templateId, templateId),
        eq(templateVersions.number, number),
      ),
    )
    .limit(1);
  return version ?? null;
}

export async function findSendableVersion(db: Executor, organizationId: string, idOrAlias: string, pinned?: number) {
  const [row] = await db
    .select({
      templateId: templates.id,
      publishedVersion: templates.publishedVersion,
      number: templateVersions.number,
      subject: templateVersions.subject,
      content: templateVersions.content,
      theme: templateVersions.theme,
      variables: templateVersions.variables,
    })
    .from(templates)
    .leftJoin(
      templateVersions,
      and(
        eq(templateVersions.templateId, templates.id),
        eq(templateVersions.number, pinned === undefined ? sql`${templates.publishedVersion}` : sql`${pinned}::integer`),
      ),
    )
    .where(inOrganization(organizationId, idOrAlias))
    .limit(1);
  return row ?? null;
}
