import createError from "@fastify/error";
import {
  creatorColumns,
  deleteTemplate,
  editorColumns,
  findSendableVersion,
  findTemplate,
  findTemplateHead,
  findTemplateVersion,
  hasPgErrorCode,
  insertTemplate,
  listTemplates,
  listTemplateVersions,
  lockTemplate,
  pgErrorCodes,
  publishTemplateVersion,
  updateTemplate,
  type Actor,
  type Database,
} from "@atlair-mail/db";
import type { Template } from "@atlair-mail/db/schema";
import {
  renderTemplate,
  validateTemplate,
  type TemplateInput,
  type TemplateSource,
  type VariableValues,
} from "@atlair-mail/templates";
import { loadAuthors, loadCreators, withAuthors } from "../lib/authors.ts";

export const TemplateNotFoundError = createError("ATL_TEMPLATE_NOT_FOUND", "Template %s not found", 404);
export const TemplateTakenError = createError("ATL_TEMPLATE_TAKEN", "Another template already uses this %s", 409);
export const TemplateChangedError = createError(
  "ATL_TEMPLATE_CHANGED",
  "Someone saved this template since you loaded it (it's now revision %d). Reload it and apply your change again",
  409,
);
export const TemplateNotPublishedError = createError(
  "ATL_TEMPLATE_NOT_PUBLISHED",
  "Template %s has no published version yet. Publish it first, or send version \"draft\" to test it",
  422,
);
export const TemplateVersionNotFoundError = createError("ATL_TEMPLATE_VERSION_NOT_FOUND", "Template %s has no version %d", 404);
export const InvalidTemplateAliasError = createError(
  "ATL_TEMPLATE_INVALID",
  "alias: can't look like an id; use a name such as welcome or password-reset",
  422,
);

const uuidShaped = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateTemplateInput extends TemplateInput {
  name: string;
  alias?: string;
}

export interface UpdateTemplateInput {
  revision: number;
  name?: string;
  alias?: string | null;
  subject?: string;
  content?: unknown;
  theme?: unknown;
  variables?: unknown;
}

export type TemplateVersionChoice = number | "draft";

export interface PublishInput {
  revision?: number;
  note?: string;
}

export interface RestoreInput {
  revision: number;
  note?: string;
}

const versionSource = (row: {
  subject: string | null;
  content: Template["content"] | null;
  theme: Template["theme"] | null;
  variables: Template["variables"] | null;
}): TemplateSource => ({ subject: row.subject!, content: row.content!, theme: row.theme!, variables: row.variables! });

const cleanNote = (note: string | undefined) => note?.trim() || null;

const sourceOf = (template: Pick<Template, "subject" | "content" | "theme" | "variables">): TemplateSource => ({
  subject: template.subject,
  content: template.content,
  theme: template.theme,
  variables: template.variables,
});

function checkAlias(alias: string | null | undefined) {
  if (alias && uuidShaped.test(alias)) throw new InvalidTemplateAliasError();
}

function takenField(error: unknown) {
  if (!hasPgErrorCode(error, pgErrorCodes.uniqueViolation)) return null;
  const constraint = (error as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? "";
  return constraint.includes("alias") ? "alias" : "name";
}

const releaseState = (template: Pick<Template, "revision" | "latestVersion" | "publishedVersion" | "publishedRevision">) => ({
  revision: template.revision,
  latestVersion: template.latestVersion,
  publishedVersion: template.publishedVersion,
  hasUnpublishedChanges: template.publishedRevision !== template.revision,
});

const publishedByOf = (version: { publishedBy: string | null; publishedByApiKeyId: string | null }) => ({
  createdBy: version.publishedBy,
  createdByApiKeyId: version.publishedByApiKeyId,
});

export function createTemplateService(db: Database) {
  const toPublic = async (template: Template) => ({
    id: template.id,
    name: template.name,
    alias: template.alias,
    subject: template.subject,
    content: template.content,
    theme: template.theme,
    variables: template.variables,
    ...releaseState(template),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    ...(await withAuthors(db, template)),
  });

  async function save<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      const field = takenField(error);
      if (field) throw new TemplateTakenError(field);
      throw error;
    }
  }

  return {
    async create(organizationId: string, input: CreateTemplateInput, actor: Actor) {
      checkAlias(input.alias);
      const source = validateTemplate(input);
      const template = await save(() =>
        insertTemplate(db, {
          organizationId,
          name: input.name,
          alias: input.alias ?? null,
          ...source,
          ...creatorColumns(actor),
          ...editorColumns(actor),
        }),
      );
      return toPublic(template);
    },

    async list(organizationId: string, query: { search?: string; before?: string; limit?: number }) {
      const limit = query.limit ?? 50;
      const rows = await listTemplates(db, {
        organizationId,
        search: query.search?.trim() || undefined,
        before: query.before,
        limit: limit + 1,
      });
      const page = rows.slice(0, limit);
      const authors = await loadAuthors(db, page);
      return { data: page.map((row) => ({ ...row, ...releaseState(row), ...authors(row) })), hasMore: rows.length > limit };
    },

    async get(organizationId: string, idOrAlias: string) {
      const template = await findTemplate(db, organizationId, idOrAlias);
      return template && toPublic(template);
    },

    async update(organizationId: string, id: string, input: UpdateTemplateInput, actor: Actor) {
      const existing = await findTemplate(db, organizationId, id);
      if (!existing || existing.id !== id) return null;
      if (existing.revision !== input.revision) throw new TemplateChangedError(existing.revision);
      checkAlias(input.alias);
      const source = validateTemplate({
        subject: input.subject ?? existing.subject,
        content: input.content ?? existing.content,
        theme: input.theme ?? existing.theme,
        variables: input.variables ?? existing.variables,
      });
      const updated = await save(() =>
        updateTemplate(
          db,
          organizationId,
          id,
          input.revision,
          { name: input.name, alias: input.alias, ...source },
          actor,
        ),
      );
      if (updated) return toPublic(updated);
      const current = await findTemplateHead(db, organizationId, id);
      if (!current) return null;
      throw new TemplateChangedError(current.revision);
    },

    async publish(organizationId: string, id: string, input: PublishInput, actor: Actor) {
      const draft = await findTemplate(db, organizationId, id);
      if (!draft || draft.id !== id) return null;
      if (input.revision !== undefined && draft.revision !== input.revision) throw new TemplateChangedError(draft.revision);
      if (draft.publishedRevision === draft.revision) return toPublic(draft);
      const source = validateTemplate(draft);
      await renderTemplate(source, {}, "preview");
      const published = await db.transaction(async (tx) => {
        const locked = await lockTemplate(tx, organizationId, id);
        if (!locked) return null;
        if (locked.revision !== draft.revision) throw new TemplateChangedError(locked.revision);
        if (locked.publishedRevision === locked.revision) return locked;
        return (await publishTemplateVersion(tx, locked, source, cleanNote(input.note), actor)).template;
      });
      return published && toPublic(published);
    },

    async versions(organizationId: string, idOrAlias: string, query: { before?: number; limit?: number }) {
      const template = await findTemplateHead(db, organizationId, idOrAlias);
      if (!template) return null;
      const limit = query.limit ?? 50;
      const rows = await listTemplateVersions(db, { organizationId, templateId: template.id, before: query.before, limit: limit + 1 });
      const page = rows.slice(0, limit);
      const creators = await loadCreators(db, page.map(publishedByOf));
      return {
        data: page.map((row) => ({ ...row, isPublished: row.number === template.publishedVersion, publishedBy: creators(publishedByOf(row)).createdBy })),
        hasMore: rows.length > limit,
      };
    },

    async version(organizationId: string, idOrAlias: string, number: number) {
      const template = await findTemplateHead(db, organizationId, idOrAlias);
      if (!template) return null;
      const version = await findTemplateVersion(db, organizationId, template.id, number);
      if (!version) throw new TemplateVersionNotFoundError(idOrAlias, number);
      const creators = await loadCreators(db, [publishedByOf(version)]);
      return { ...version, isPublished: version.number === template.publishedVersion, publishedBy: creators(publishedByOf(version)).createdBy };
    },

    async restore(organizationId: string, id: string, number: number, input: RestoreInput, actor: Actor) {
      const version = await findTemplateVersion(db, organizationId, id, number);
      if (!version) {
        if (!(await findTemplateHead(db, organizationId, id))) return null;
        throw new TemplateVersionNotFoundError(id, number);
      }
      const source = validateTemplate(version);
      const restored = await updateTemplate(db, organizationId, id, input.revision, source, actor);
      if (restored) return toPublic(restored);
      const current = await findTemplateHead(db, organizationId, id);
      if (!current) return null;
      throw new TemplateChangedError(current.revision);
    },

    async rollback(organizationId: string, id: string, number: number, input: RestoreInput, actor: Actor) {
      const version = await findTemplateVersion(db, organizationId, id, number);
      if (!version) {
        if (!(await findTemplateHead(db, organizationId, id))) return null;
        throw new TemplateVersionNotFoundError(id, number);
      }
      const source = validateTemplate(version);
      const note = cleanNote(input.note) ?? `Rolled back to v${number}`;
      const published = await db.transaction(async (tx) => {
        const locked = await lockTemplate(tx, organizationId, id);
        if (!locked) return null;
        if (locked.revision !== input.revision) throw new TemplateChangedError(locked.revision);
        const restored = await updateTemplate(tx, organizationId, id, input.revision, source, actor);
        return (await publishTemplateVersion(tx, restored!, source, note, actor)).template;
      });
      return published && toPublic(published);
    },

    remove: (organizationId: string, id: string) => deleteTemplate(db, organizationId, id),

    previewDraft: (input: TemplateInput, values: VariableValues = {}) => renderTemplate(validateTemplate(input), values, "preview"),

    async preview(organizationId: string, idOrAlias: string, values: VariableValues = {}, choice: TemplateVersionChoice = "draft") {
      if (choice === "draft") {
        const template = await findTemplate(db, organizationId, idOrAlias);
        return template && renderTemplate(sourceOf(template), values, "preview");
      }
      const row = await findSendableVersion(db, organizationId, idOrAlias, choice);
      if (!row) return null;
      if (row.number === null) throw new TemplateVersionNotFoundError(idOrAlias, choice);
      return renderTemplate(versionSource(row), values, "preview");
    },

    async renderForSend(organizationId: string, idOrAlias: string, values: VariableValues = {}, choice?: TemplateVersionChoice) {
      if (choice === "draft") {
        const template = await findTemplate(db, organizationId, idOrAlias);
        if (!template) throw new TemplateNotFoundError(idOrAlias);
        return { templateId: template.id, version: null, rendered: await renderTemplate(sourceOf(template), values, "send") };
      }
      const row = await findSendableVersion(db, organizationId, idOrAlias, choice);
      if (!row) throw new TemplateNotFoundError(idOrAlias);
      if (row.number === null) {
        if (choice === undefined) throw new TemplateNotPublishedError(idOrAlias);
        throw new TemplateVersionNotFoundError(idOrAlias, choice);
      }
      const rendered = await renderTemplate(versionSource(row), values, "send");
      return { templateId: row.templateId, version: row.number, rendered };
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
