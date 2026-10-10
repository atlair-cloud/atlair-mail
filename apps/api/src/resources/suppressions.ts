import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import {
  AddSuppressionSchema,
  SuppressionListQuerySchema,
  SuppressionListSchema,
  SuppressionSchema,
} from "../schemas/suppressions.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Suppressions"];

export const suppressionRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    fastify.get(
      "/",
      {
        config: scope.config(["suppression:view"]),
        schema: {
          summary: "List suppressed addresses",
          description:
            "Addresses that emails are never sent to. Oldest first; pass the last id as after to get the next page, or address to look one up.",
          tags,
          ...scope.security,
          params: scope.params(),
          querystring: SuppressionListQuerySchema,
          response: { 200: SuppressionListSchema },
        },
      },
      async (request) => fastify.services.suppressions.list(scope.organizationId(request), request.query),
    );

    fastify.post(
      "/",
      {
        config: scope.config(["suppression:create"]),
        schema: {
          summary: "Suppress an address",
          description: "Stops all sending to the address. Returns 200 with the existing entry if it is already suppressed.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: AddSuppressionSchema,
          response: { 200: SuppressionSchema, 201: SuppressionSchema },
        },
      },
      async (request, reply) => {
        const { suppression, created } = await fastify.services.suppressions.add(
          scope.organizationId(request),
          request.body.address,
        );
        return reply.code(created ? 201 : 200).send(suppression);
      },
    );

    fastify.delete(
      "/:id",
      {
        config: scope.config(["suppression:delete"]),
        schema: {
          summary: "Remove a suppressed address",
          description:
            "Allows sending to the address again. Only remove an entry once you know the address is valid and the recipient wants your email.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          response: { 204: Type.Null() },
        },
      },
      async (request, reply) => {
        const removed = await fastify.services.suppressions.remove(scope.organizationId(request), request.params.id);
        if (!removed) throw fastify.httpErrors.notFound("Suppression not found");
        return reply.code(204).send(null);
      },
    );
  };
