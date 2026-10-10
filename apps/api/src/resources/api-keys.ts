import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import { ApiKeyPermissionSchema, ApiKeySchema, CreatedApiKeySchema } from "../schemas/api-keys.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["API keys"];

export const apiKeyRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    fastify.post(
      "/",
      {
        config: scope.config(["api_key:create"]),
        schema: {
          summary: "Create an API key",
          description: "Requires a full_access key. The token is returned only in this response.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: Type.Object({
            name: Type.String({ minLength: 1, maxLength: 50 }),
            permission: Type.Optional(ApiKeyPermissionSchema),
          }),
          response: { 201: CreatedApiKeySchema },
        },
      },
      async (request, reply) => {
        const key = await fastify.services.apiKeys.create(scope.organizationId(request), request.body, scope.actor(request));
        return reply.code(201).send(key);
      },
    );

    fastify.get(
      "/",
      {
        config: scope.config(["api_key:view"]),
        schema: {
          summary: "List API keys",
          description: "Includes revoked keys. Tokens are never returned.",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 200: Type.Object({ data: Type.Array(ApiKeySchema) }) },
        },
      },
      async (request) => ({ data: await fastify.services.apiKeys.list(scope.organizationId(request)) }),
    );

    fastify.delete(
      "/:id",
      {
        config: scope.config(["api_key:revoke"]),
        schema: {
          summary: "Revoke an API key",
          description: "The key stops working immediately. Revoking an already revoked key is a no-op.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          response: { 200: ApiKeySchema },
        },
      },
      async (request) => {
        const key = await fastify.services.apiKeys.revoke(scope.organizationId(request), request.params.id, scope.actor(request));
        if (!key) throw fastify.httpErrors.notFound("API key not found");
        return key;
      },
    );
  };
