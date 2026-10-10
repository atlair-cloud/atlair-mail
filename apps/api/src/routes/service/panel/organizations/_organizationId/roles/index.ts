import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../../../lib/schemas.ts";
import { RoleSchema } from "../../../../../../schemas/panel.ts";

const roleRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      config: { permissions: ["member:view"] },
      schema: {
        summary: "List roles and their permissions",
        tags: ["Panel"],
        security: [{ panelSession: [] }],
        params: Type.Object({ organizationId: Uuid() }),
        response: { 200: Type.Object({ data: Type.Array(RoleSchema) }) },
      },
    },
    async (request) => ({ data: await fastify.services.roles.list(request.params.organizationId) }),
  );
};

export default roleRoutes;
