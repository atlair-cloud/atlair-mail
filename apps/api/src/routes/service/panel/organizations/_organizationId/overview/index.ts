import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../../../lib/schemas.ts";
import { OverviewSchema } from "../../../../../../schemas/overview.ts";

const overviewRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      config: { permissions: ["organization:view"] },
      schema: {
        summary: "Get the organization's overview",
        description: "Setup progress, sending health over the last 24 hours and 7 days, problems to fix, domains and recent emails.",
        tags: ["Panel"],
        security: [{ panelSession: [] }],
        params: Type.Object({ organizationId: Uuid() }),
        response: { 200: OverviewSchema },
      },
    },
    async (request) => fastify.services.overview.get(request.params.organizationId),
  );
};

export default overviewRoutes;
