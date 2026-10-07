import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { apiKeyPermissions } from "@atlair-mail/db";

const ApiKeySchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  organizationId: Type.String({ format: "uuid" }),
  permission: Type.Enum(apiKeyPermissions),
});

const apiKeyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/current",
    {
      schema: {
        summary: "Get the API key used for this request",
        tags: ["API keys"],
        response: { 200: ApiKeySchema },
      },
    },
    async (request) => {
      return request.apiKey!;
    },
  );
};

export default apiKeyRoutes;
