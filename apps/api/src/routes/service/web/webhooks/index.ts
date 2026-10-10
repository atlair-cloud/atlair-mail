import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../lib/schemas.ts";
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
} from "../../../../schemas/webhooks.ts";

const tags = ["Webhooks"];
const params = Type.Object({ id: Uuid() });

const webhookRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const notFound = (): never => {
    throw fastify.httpErrors.notFound("Webhook not found");
  };

  fastify.post(
    "/",
    {
      schema: {
        summary: "Create a webhook endpoint",
        description:
          "Email events are POSTed to url, signed with the Standard Webhooks scheme. The signing secret is returned only in this response.",
        tags,
        body: CreateWebhookSchema,
        response: { 201: CreatedWebhookSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await fastify.services.webhooks.create(request.apiKey!.organizationId, request.body)),
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "List webhook endpoints",
        tags,
        response: { 200: WebhookListSchema },
      },
    },
    async (request) => fastify.services.webhooks.list(request.apiKey!.organizationId),
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "Get a webhook endpoint",
        tags,
        params,
        response: { 200: WebhookSchema },
      },
    },
    async (request) =>
      (await fastify.services.webhooks.get(request.apiKey!.organizationId, request.params.id)) ?? notFound(),
  );

  fastify.patch(
    "/:id",
    {
      schema: {
        summary: "Update a webhook endpoint",
        description: "Change the url or event types, or disable and re-enable the endpoint.",
        tags,
        params,
        body: UpdateWebhookSchema,
        response: { 200: WebhookSchema },
      },
    },
    async (request) =>
      (await fastify.services.webhooks.update(request.apiKey!.organizationId, request.params.id, request.body)) ??
      notFound(),
  );

  fastify.post(
    "/:id/rotate-secret",
    {
      schema: {
        summary: "Rotate a webhook endpoint's signing secret",
        description:
          "Returns a new signing secret, shown only in this response. Until previousSecretExpiresAt, each request carries signatures from both the new and the previous secret, so receivers can switch at any time. Rotating again during the overlap replaces the previous secret.",
        tags,
        params,
        body: RotateSecretSchema,
        response: { 200: RotatedWebhookSchema },
      },
      preValidation: async (request) => {
        request.body ??= {};
      },
    },
    async (request) =>
      (await fastify.services.webhooks.rotateSecret(request.apiKey!.organizationId, request.params.id, request.body)) ??
      notFound(),
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "Delete a webhook endpoint",
        description: "Also deletes its delivery history and anything not yet delivered.",
        tags,
        params,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const removed = await fastify.services.webhooks.remove(request.apiKey!.organizationId, request.params.id);
      if (!removed) notFound();
      return reply.code(204).send(null);
    },
  );

  fastify.get(
    "/:id/deliveries",
    {
      schema: {
        summary: "List a webhook endpoint's deliveries",
        description: "Newest first; pass the last id as before to get the next page.",
        tags,
        params,
        querystring: WebhookDeliveryQuerySchema,
        response: { 200: WebhookDeliveryListSchema },
      },
    },
    async (request) =>
      (await fastify.services.webhooks.deliveries(request.apiKey!.organizationId, request.params.id, request.query)) ??
      notFound(),
  );
};

export default webhookRoutes;
