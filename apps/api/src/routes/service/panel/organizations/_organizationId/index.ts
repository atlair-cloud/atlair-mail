import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../../lib/schemas.ts";
import { OrganizationNameSchema, OrganizationSchema, OrganizationSlugSchema } from "../../../../../schemas/panel.ts";

const tags = ["Panel"];
const params = Type.Object({ organizationId: Uuid() });

const organizationDetailRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      config: { permissions: ["organization:view"] },
      schema: {
        summary: "Get an organization",
        tags,
        security: [{ panelSession: [] }],
        params,
        response: { 200: Type.Object({ ...OrganizationSchema.properties, role: Type.String() }) },
      },
    },
    async (request) => {
      const organization = await fastify.services.organizations.get(request.params.organizationId);
      return { ...organization!, role: request.membership!.roleName };
    },
  );

  fastify.patch(
    "/",
    {
      config: { permissions: ["organization:update"] },
      schema: {
        summary: "Update an organization",
        tags,
        security: [{ panelSession: [] }],
        params,
        body: Type.Object(
          { name: Type.Optional(OrganizationNameSchema), slug: Type.Optional(OrganizationSlugSchema) },
          { minProperties: 1 },
        ),
        response: { 200: OrganizationSchema },
      },
    },
    async (request) => {
      const organization = await fastify.services.organizations.update({
        organizationId: request.params.organizationId,
        actorUserId: request.user!.id,
        ...request.body,
      });
      return organization!;
    },
  );

  fastify.delete(
    "/",
    {
      config: { permissions: ["organization:delete"] },
      schema: {
        summary: "Deactivate an organization",
        description: "Members lose access. Its data is kept.",
        tags,
        security: [{ panelSession: [] }],
        params,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      await fastify.services.organizations.deactivate({
        organizationId: request.params.organizationId,
        actorUserId: request.user!.id,
      });
      return reply.code(204).send(null);
    },
  );
};

export default organizationDetailRoutes;
