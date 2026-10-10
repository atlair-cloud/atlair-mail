import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../../lib/schemas.ts";
import {
  AddSuppressionSchema,
  SuppressionListQuerySchema,
  SuppressionListSchema,
  SuppressionSchema,
} from "../../../../schemas/suppressions.ts";

const tags = ["Suppressions"];

const suppressionRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      schema: {
        summary: "List suppressed addresses",
        description:
          "Addresses that emails are never sent to. Oldest first; pass the last id as after to get the next page, or address to look one up.",
        tags,
        querystring: SuppressionListQuerySchema,
        response: { 200: SuppressionListSchema },
      },
    },
    async (request) => fastify.services.suppressions.list(request.apiKey!.organizationId, request.query),
  );

  fastify.post(
    "/",
    {
      schema: {
        summary: "Suppress an address",
        description: "Stops all sending to the address. Returns 200 with the existing entry if it is already suppressed.",
        tags,
        body: AddSuppressionSchema,
        response: { 200: SuppressionSchema, 201: SuppressionSchema },
      },
    },
    async (request, reply) => {
      const { suppression, created } = await fastify.services.suppressions.add(
        request.apiKey!.organizationId,
        request.body.address,
      );
      return reply.code(created ? 201 : 200).send(suppression);
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "Remove a suppressed address",
        description:
          "Allows sending to the address again. Only remove an entry once you know the address is valid and the recipient wants your email.",
        tags,
        params: Type.Object({ id: Uuid() }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const removed = await fastify.services.suppressions.remove(request.apiKey!.organizationId, request.params.id);
      if (!removed) throw fastify.httpErrors.notFound("Suppression not found");
      return reply.code(204).send(null);
    },
  );
};

export default suppressionRoutes;
