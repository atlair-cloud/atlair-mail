import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { apiKeyRoutes } from "../../../../resources/api-keys.ts";
import { webScope } from "../../../../resources/scope.ts";
import { CurrentApiKeySchema } from "../../../../schemas/api-keys.ts";

const webApiKeyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  await fastify.register(apiKeyRoutes(webScope));

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
    async (request) => request.apiKey!,
  );
};

export default webApiKeyRoutes;
