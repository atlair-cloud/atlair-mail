import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import {
  CreatedWebhookSchema,
  CreateWebhookSchema,
  RotatedWebhookSchema,
  RotateSecretSchema,
  UpdateWebhookSchema,
  WebhookDeliveryListSchema,
  WebhookDeliveryQuerySchema,
  WebhookListSchema,
  WebhookSchema,
} from "../schemas/webhooks.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Webhooks"];

export const webhookRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    const params = scope.params({ id: Uuid() });
    const notFound = (): never => {
      throw fastify.httpErrors.notFound("Webhook not found");
    };

    fastify.post(
      "/",
      {
        config: scope.config(["webhook:create"]),
        schema: {
          summary: "Create a webhook endpoint",
          description:
            "Email events are POSTed to url, signed with the Standard Webhooks scheme. The signing secret is returned only in this response.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: CreateWebhookSchema,
          response: { 201: CreatedWebhookSchema },
        },
      },
      async (request, reply) =>
        reply.code(201).send(await fastify.services.webhooks.create(scope.organizationId(request), request.body, scope.actor(request))),
    );

    fastify.get(
      "/",
      {
        config: scope.config(["webhook:view"]),
        schema: {
          summary: "List webhook endpoints",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 200: WebhookListSchema },
        },
      },
      async (request) => fastify.services.webhooks.list(scope.organizationId(request)),
    );

    fastify.get(
      "/:id",
      {
        config: scope.config(["webhook:view"]),
        schema: {
          summary: "Get a webhook endpoint",
          tags,
          ...scope.security,
          params,
          response: { 200: WebhookSchema },
        },
      },
      async (request) =>
        (await fastify.services.webhooks.get(scope.organizationId(request), request.params.id)) ?? notFound(),
    );

    fastify.patch(
      "/:id",
      {
        config: scope.config(["webhook:update"]),
        schema: {
          summary: "Update a webhook endpoint",
          description: "Change the url or event types, or disable and re-enable the endpoint.",
          tags,
          ...scope.security,
          params,
          body: UpdateWebhookSchema,
          response: { 200: WebhookSchema },
        },
      },
      async (request) =>
        (await fastify.services.webhooks.update(scope.organizationId(request), request.params.id, request.body, scope.actor(request))) ??
        notFound(),
    );

    fastify.post(
      "/:id/rotate-secret",
      {
        config: scope.config(["webhook:update"]),
        schema: {
          summary: "Rotate a webhook endpoint's signing secret",
          description:
            "Returns a new signing secret, shown only in this response. Until previousSecretExpiresAt, each request carries signatures from both the new and the previous secret, so receivers can switch at any time. Rotating again during the overlap replaces the previous secret.",
          tags,
          ...scope.security,
          params,
          body: RotateSecretSchema,
          response: { 200: RotatedWebhookSchema },
        },
        preValidation: async (request) => {
          request.body ??= {};
        },
      },
      async (request) =>
        (await fastify.services.webhooks.rotateSecret(scope.organizationId(request), request.params.id, request.body, scope.actor(request))) ??
        notFound(),
    );

    fastify.delete(
      "/:id",
      {
        config: scope.config(["webhook:delete"]),
        schema: {
          summary: "Delete a webhook endpoint",
          description: "Also deletes its delivery history and anything not yet delivered.",
          tags,
          ...scope.security,
          params,
          response: { 204: Type.Null() },
        },
      },
      async (request, reply) => {
        const removed = await fastify.services.webhooks.remove(scope.organizationId(request), request.params.id, scope.actor(request));
        if (!removed) notFound();
        return reply.code(204).send(null);
      },
    );

    fastify.get(
      "/:id/deliveries",
      {
        config: scope.config(["webhook:view"]),
        schema: {
          summary: "List a webhook endpoint's deliveries",
          description: "Newest first; pass the last id as before to get the next page.",
          tags,
          ...scope.security,
          params,
          querystring: WebhookDeliveryQuerySchema,
          response: { 200: WebhookDeliveryListSchema },
        },
      },
      async (request) =>
        (await fastify.services.webhooks.deliveries(scope.organizationId(request), request.params.id, request.query)) ??
        notFound(),
    );
  };
