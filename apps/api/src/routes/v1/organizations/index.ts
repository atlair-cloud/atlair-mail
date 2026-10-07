import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { DateTime, Uuid } from "../../../lib/schemas.ts";
import { CreatedApiKeySchema } from "../../../schemas/api-keys.ts";

const OrganizationSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
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
        body: Type.Object({ name: Type.String({ minLength: 1, maxLength: 100 }) }),
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
};

export default organizationRoutes;
