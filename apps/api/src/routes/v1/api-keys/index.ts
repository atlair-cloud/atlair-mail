import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../lib/schemas.ts";
import {
  ApiKeyPermissionSchema,
  ApiKeySchema,
  CreatedApiKeySchema,
  CurrentApiKeySchema,
} from "../../../schemas/api-keys.ts";

const apiKeyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        summary: "Create an API key",
        description: "Requires a full_access key. The token is returned only in this response.",
        tags: ["API keys"],
        body: Type.Object({
          name: Type.String({ minLength: 1, maxLength: 50 }),
          permission: Type.Optional(ApiKeyPermissionSchema),
        }),
        response: { 201: CreatedApiKeySchema },
      },
    },
    async (request, reply) => {
      const key = await fastify.services.apiKeys.create(request.apiKey!.organizationId, request.body);
      return reply.code(201).send(key);
    },
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "List API keys",
        description: "Includes revoked keys. Tokens are never returned.",
        tags: ["API keys"],
        response: { 200: Type.Object({ data: Type.Array(ApiKeySchema) }) },
      },
    },
    async (request) => {
      return { data: await fastify.services.apiKeys.list(request.apiKey!.organizationId) };
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "Revoke an API key",
        description: "The key stops working immediately. Revoking an already revoked key is a no-op.",
        tags: ["API keys"],
        params: Type.Object({ id: Uuid() }),
        response: { 200: ApiKeySchema },
      },
    },
    async (request) => {
      const key = await fastify.services.apiKeys.revoke(
        request.apiKey!.organizationId,
        request.params.id,
      );
      if (!key) throw fastify.httpErrors.notFound("API key not found");
      return key;
    },
  );

  fastify.get(
    "/current",
    {
      config: { permission: "sending_access" },
      schema: {
        summary: "Get the API key used for this request",
        tags: ["API keys"],
        response: { 200: CurrentApiKeySchema },
      },
    },
    async (request) => {
      return request.apiKey!;
    },
  );
};

export default apiKeyRoutes;
