import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  OrganizationNameSchema,
  OrganizationSlugSchema,
  PageQuerySchema,
  UserOrganizationSchema,
} from "../../../../schemas/panel.ts";

const tags = ["Panel"];

const organizationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "List the signed-in user's organizations",
        description: "Newest first; pass the last id as before to get the next page.",
        tags,
        security: [{ panelSession: [] }],
        querystring: PageQuerySchema,
        response: { 200: Type.Object({ data: Type.Array(UserOrganizationSchema) }) },
      },
    },
    async (request) => ({
      data: await fastify.services.organizations.listForUser(request.user!.id, {
        before: request.query.before,
        limit: request.query.limit ?? 50,
      }),
    }),
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "Create an organization",
        description: "The signed-in user becomes its owner. A slug is generated from the name when not given.",
        tags,
        security: [{ panelSession: [] }],
        body: Type.Object({ name: OrganizationNameSchema, slug: Type.Optional(OrganizationSlugSchema) }),
        response: { 201: UserOrganizationSchema },
      },
    },
    async (request, reply) => {
      const organization = await fastify.services.organizations.createForUser({
        ...request.body,
        userId: request.user!.id,
      });
      return reply.code(201).send(organization);
    },
  );

  fastify.get(
    "/slug-availability",
    {
      schema: {
        summary: "Check whether an organization slug is free",
        tags,
        security: [{ panelSession: [] }],
        querystring: Type.Object({ slug: OrganizationSlugSchema }),
        response: { 200: Type.Object({ available: Type.Boolean() }) },
      },
    },
    async (request) => ({ available: await fastify.services.organizations.isSlugAvailable(request.query.slug) }),
  );
};

export default organizationRoutes;
