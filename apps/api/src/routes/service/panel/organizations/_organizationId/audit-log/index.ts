import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../../../lib/schemas.ts";
import { AuditLogSchema, PageQuerySchema } from "../../../../../../schemas/panel.ts";

const auditLogRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      config: { permissions: ["audit:view"] },
      schema: {
        summary: "List the organization's audit log",
        description: "Newest first; pass the last id as before to get the next page.",
        tags: ["Panel"],
        security: [{ panelSession: [] }],
        params: Type.Object({ organizationId: Uuid() }),
        querystring: PageQuerySchema,
        response: { 200: Type.Object({ data: Type.Array(AuditLogSchema) }) },
      },
    },
    async (request) => ({
      data: await fastify.services.auditLogs.list(request.params.organizationId, {
        before: request.query.before,
        limit: request.query.limit ?? 50,
      }),
    }),
  );
};

export default auditLogRoutes;
