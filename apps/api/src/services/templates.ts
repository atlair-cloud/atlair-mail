import createError from "@fastify/error";
import {
  creatorColumns,
  deleteTemplate,
  editorColumns,
  findTemplate,
  hasPgErrorCode,
  insertTemplate,
  listTemplates,
  pgErrorCodes,
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
import { loadAuthors, withAuthors } from "../lib/authors.ts";

export const TemplateNotFoundError = createError("ATL_TEMPLATE_NOT_FOUND", "Template %s not found", 404);
export const TemplateTakenError = createError("ATL_TEMPLATE_TAKEN", "Another template already uses this %s", 409);
export const TemplateChangedError = createError(
  "ATL_TEMPLATE_CHANGED",
  "Someone saved this template since you loaded it (it's now version %d). Reload it and apply your change again",
  409,
);
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
  version: number;
  name?: string;
  alias?: string | null;
  subject?: string;
  content?: unknown;
  theme?: unknown;
  variables?: unknown;
}

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

export function createTemplateService(db: Database) {
  const toPublic = async (template: Template) => ({
    id: template.id,
    name: template.name,
    alias: template.alias,
    subject: template.subject,
    content: template.content,
    theme: template.theme,
    variables: template.variables,
    version: template.version,
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
      return { data: page.map((row) => ({ ...row, ...authors(row) })), hasMore: rows.length > limit };
    },

    async get(organizationId: string, idOrAlias: string) {
      const template = await findTemplate(db, organizationId, idOrAlias);
      return template && toPublic(template);
    },

    async update(organizationId: string, id: string, input: UpdateTemplateInput, actor: Actor) {
      const existing = await findTemplate(db, organizationId, id);
      if (!existing || existing.id !== id) return null;
      if (existing.version !== input.version) throw new TemplateChangedError(existing.version);
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
          input.version,
          { name: input.name, alias: input.alias, ...source },
          actor,
        ),
      );
      if (updated) return toPublic(updated);
      const current = await findTemplate(db, organizationId, id);
      if (!current) return null;
      throw new TemplateChangedError(current.version);
    },

    remove: (organizationId: string, id: string) => deleteTemplate(db, organizationId, id),

    async preview(organizationId: string, idOrAlias: string, values: VariableValues = {}) {
      const template = await findTemplate(db, organizationId, idOrAlias);
      return template && renderTemplate(sourceOf(template), values, "preview");
    },

    previewDraft: (input: TemplateInput, values: VariableValues = {}) => renderTemplate(validateTemplate(input), values, "preview"),

    async renderForSend(organizationId: string, idOrAlias: string, values: VariableValues = {}) {
      const template = await findTemplate(db, organizationId, idOrAlias);
      if (!template) throw new TemplateNotFoundError(idOrAlias);
      const rendered = await renderTemplate(sourceOf(template), values, "send");
      return { template, rendered };
    },
  };
}

export type TemplateService = ReturnType<typeof createTemplateService>;
