import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { DateTime, Uuid } from "../../../../lib/schemas.ts";
import { CreatedApiKeySchema } from "../../../../schemas/api-keys.ts";
import {
  MemberSchema,
  OrganizationNameSchema,
  OrganizationSlugSchema,
  RoleNameSchema,
} from "../../../../schemas/panel.ts";

const OrganizationSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  slug: Type.String(),
  createdAt: DateTime(),
});

const organizationRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      config: { access: "root" },
      schema: {
        summary: "Create an organization and its first API key",
        description: "Requires the root API key. The new key's token is returned only in this response.",
        tags: ["Organizations"],
        body: Type.Object({ name: OrganizationNameSchema, slug: Type.Optional(OrganizationSlugSchema) }),
        response: {
          201: Type.Object({ ...OrganizationSchema.properties, apiKey: CreatedApiKeySchema }),
        },
      },
    },
    async (request, reply) => {
      const created = await fastify.services.organizations.create(request.body);
      return reply.code(201).send(created);
    },
  );

  fastify.get(
    "/:id",
    {
      config: { access: "root" },
      schema: {
        summary: "Get an organization",
        description: "Requires the root API key.",
        tags: ["Organizations"],
        params: Type.Object({ id: Uuid() }),
        response: { 200: OrganizationSchema },
      },
    },
    async (request) => {
      const organization = await fastify.services.organizations.get(request.params.id);
      if (!organization) throw fastify.httpErrors.notFound("Organization not found");
      return organization;
    },
  );

  fastify.post(
    "/:id/members",
    {
      config: { access: "root" },
      schema: {
        summary: "Add a member to an organization",
        description:
          "Requires the root API key. The person must already have an account. Use role owner to hand an organization without an owner to its first owner.",
        tags: ["Organizations"],
        params: Type.Object({ id: Uuid() }),
        body: Type.Object({ email: Type.String({ format: "email", maxLength: 254 }), role: RoleNameSchema }),
        response: { 201: MemberSchema },
      },
    },
    async (request, reply) => {
      const organization = await fastify.services.organizations.get(request.params.id);
      if (!organization) throw fastify.httpErrors.notFound("Organization not found");
      const member = await fastify.services.members.add({
        organizationId: organization.id,
        email: request.body.email,
        role: request.body.role,
        actorUserId: null,
        allowFirstOwner: true,
      });
      return reply.code(201).send(member);
    },
  );
};

export default organizationRoutes;
