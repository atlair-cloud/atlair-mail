import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import {
  CreateTemplateSchema,
  PreviewDraftSchema,
  PreviewTemplateSchema,
  PublishTemplateSchema,
  RenderedTemplateSchema,
  RestoreVersionSchema,
  RollbackVersionSchema,
  TemplateIdOrAlias,
  TemplateListQuerySchema,
  TemplateListSchema,
  TemplateSchema,
  TemplateVersionListQuerySchema,
  TemplateVersionListSchema,
  TemplateVersionSchema,
  UpdateTemplateSchema,
  VersionNumber,
} from "../schemas/templates.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Templates"];

export const templateRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    const notFound = (): never => {
      throw fastify.httpErrors.notFound("Template not found");
    };

    fastify.post(
      "/",
      {
        config: scope.config(["template:create"]),
        schema: {
          summary: "Create a template",
          description:
            "Saves a design to send by id or alias. Every {{variable}} used in the subject or content must be declared in variables.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: CreateTemplateSchema,
          response: { 201: TemplateSchema },
        },
      },
      async (request, reply) =>
        reply.code(201).send(await fastify.services.templates.create(scope.organizationId(request), request.body, scope.actor(request))),
    );

    fastify.get(
      "/",
      {
        config: scope.config(["template:view"], "sending_access"),
        schema: {
          summary: "List templates",
          description: "Newest first, without content. While hasMore is true, pass the last id as before to get the next page.",
          tags,
          ...scope.security,
          params: scope.params(),
          querystring: TemplateListQuerySchema,
          response: { 200: TemplateListSchema },
        },
      },
      async (request) => fastify.services.templates.list(scope.organizationId(request), request.query),
    );

    fastify.post(
      "/preview",
      {
        config: scope.config(["template:view"]),
        schema: {
          summary: "Preview an unsaved template",
          description: "Renders a design without saving it. Variables without a value or fallback stay as {{name}}.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: PreviewDraftSchema,
          response: { 200: RenderedTemplateSchema },
        },
      },
      async (request) => {
        const { values, ...input } = request.body;
        return fastify.services.templates.previewDraft(input, values);
      },
    );

    fastify.get(
      "/:id",
      {
        config: scope.config(["template:view"], "sending_access"),
        schema: {
          summary: "Get a template",
          tags,
          ...scope.security,
          params: scope.params({ id: TemplateIdOrAlias }),
          response: { 200: TemplateSchema },
        },
      },
      async (request) => (await fastify.services.templates.get(scope.organizationId(request), request.params.id)) ?? notFound(),
    );

    fastify.post(
      "/:id/preview",
      {
        config: scope.config(["template:view"], "sending_access"),
        schema: {
          summary: "Preview a template",
          description:
            "Renders the draft, or a published version, with these values. Variables without a value or fallback stay as {{name}}.",
          tags,
          ...scope.security,
          params: scope.params({ id: TemplateIdOrAlias }),
          body: PreviewTemplateSchema,
          response: { 200: RenderedTemplateSchema },
        },
        preValidation: async (request) => {
          request.body ??= {};
        },
      },
      async (request) =>
        (await fastify.services.templates.preview(
          scope.organizationId(request),
          request.params.id,
          request.body.variables,
          request.body.version,
        )) ?? notFound(),
    );

    fastify.patch(
      "/:id",
      {
        config: scope.config(["template:update"]),
        schema: {
          summary: "Update a template",
          description:
            "Saves changes to the draft. Emails keep using the published version until you publish. Send the revision you loaded: if the draft changed since, this fails with 409 ATL_TEMPLATE_CHANGED so no edit is lost.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          body: UpdateTemplateSchema,
          response: { 200: TemplateSchema },
        },
      },
      async (request) =>
        (await fastify.services.templates.update(scope.organizationId(request), request.params.id, request.body, scope.actor(request))) ??
        notFound(),
    );

    fastify.post(
      "/:id/publish",
      {
        config: scope.config(["template:publish"]),
        schema: {
          summary: "Publish a template",
          description:
            "Saves the draft as the next version and sends with it from now on. Pass the revision you reviewed to be sure you publish exactly that. Publishing a draft with no changes returns the template as is.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          body: PublishTemplateSchema,
          response: { 200: TemplateSchema },
        },
        preValidation: async (request) => {
          request.body ??= {};
        },
      },
      async (request) =>
        (await fastify.services.templates.publish(scope.organizationId(request), request.params.id, request.body, scope.actor(request))) ??
        notFound(),
    );

    fastify.get(
      "/:id/versions",
      {
        config: scope.config(["template:view"], "sending_access"),
        schema: {
          summary: "List a template's versions",
          description: "Newest first, without content. While hasMore is true, pass the last number as before to get the next page.",
          tags,
          ...scope.security,
          params: scope.params({ id: TemplateIdOrAlias }),
          querystring: TemplateVersionListQuerySchema,
          response: { 200: TemplateVersionListSchema },
        },
      },
      async (request) =>
        (await fastify.services.templates.versions(scope.organizationId(request), request.params.id, request.query)) ?? notFound(),
    );

    fastify.get(
      "/:id/versions/:number",
      {
        config: scope.config(["template:view"], "sending_access"),
        schema: {
          summary: "Get a template version",
          tags,
          ...scope.security,
          params: scope.params({ id: TemplateIdOrAlias, number: VersionNumber }),
          response: { 200: TemplateVersionSchema },
        },
      },
      async (request) =>
        (await fastify.services.templates.version(scope.organizationId(request), request.params.id, request.params.number)) ??
        notFound(),
    );

    fastify.post(
      "/:id/versions/:number/restore",
      {
        config: scope.config(["template:update"]),
        schema: {
          summary: "Restore a version to the draft",
          description: "Replaces the draft with this version. Nothing is sent with it until you publish.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid(), number: VersionNumber }),
          body: RestoreVersionSchema,
          response: { 200: TemplateSchema },
        },
      },
      async (request) =>
        (await fastify.services.templates.restore(
          scope.organizationId(request),
          request.params.id,
          request.params.number,
          request.body,
          scope.actor(request),
        )) ?? notFound(),
    );

    fastify.post(
      "/:id/versions/:number/publish",
      {
        config: scope.config(["template:update", "template:publish"]),
        schema: {
          summary: "Roll back to a version",
          description:
            "Restores this version to the draft and publishes it as a new version, so the history keeps every change. Emails send with it right away.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid(), number: VersionNumber }),
          body: RollbackVersionSchema,
          response: { 200: TemplateSchema },
        },
      },
      async (request) =>
        (await fastify.services.templates.rollback(
          scope.organizationId(request),
          request.params.id,
          request.params.number,
          request.body,
          scope.actor(request),
        )) ?? notFound(),
    );

    fastify.delete(
      "/:id",
      {
        config: scope.config(["template:delete"]),
        schema: {
          summary: "Delete a template",
          description: "Deletes the draft and every version. Emails already sent with it keep their content.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          response: { 204: Type.Null() },
        },
      },
      async (request, reply) => {
        const removed = await fastify.services.templates.remove(scope.organizationId(request), request.params.id, scope.actor(request));
        if (!removed) notFound();
        return reply.code(204).send(null);
      },
    );
  };
