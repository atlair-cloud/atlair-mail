import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { UserSchema } from "../../../../schemas/panel.ts";

const meRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "Get the signed-in user",
        tags: ["Panel"],
        security: [{ panelSession: [] }],
        response: { 200: UserSchema },
      },
    },
    async (request) => ({ ...request.user!, image: request.user!.image ?? null }),
  );
};

export default meRoutes;
