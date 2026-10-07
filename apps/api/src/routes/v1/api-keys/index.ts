import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

const apiKeyRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/current",
    {
      schema: {
        summary: "Get the API key used for this request",
        tags: ["API keys"],
        response: { 200: Type.Object({ id: Type.String() }) },
      },
    },
    async (request) => {
      // bearer-auth already rejected requests without a valid key.
      return { id: request.apiKey!.id };
    },
  );
};

export default apiKeyRoutes;
