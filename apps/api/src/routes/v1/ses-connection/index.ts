import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  SavedSesConnectionSchema,
  SaveSesConnectionSchema,
  SesConnectionSchema,
} from "../../../schemas/ses-connections.ts";

const sesConnectionRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.put(
    "/",
    {
      schema: {
        summary: "Connect your Amazon SES account",
        description:
          "Checks the credentials with SES, then stores the secret access key encrypted. Replaces any existing connection. The secret is never returned.",
        tags: ["SES connection"],
        body: SaveSesConnectionSchema,
        response: { 200: SavedSesConnectionSchema },
      },
    },
    async (request) => {
      return fastify.services.sesConnections.save(request.apiKey!.organizationId, request.body);
    },
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "Get the SES connection",
        tags: ["SES connection"],
        response: { 200: SesConnectionSchema },
      },
    },
    async (request) => {
      const connection = await fastify.services.sesConnections.get(request.apiKey!.organizationId);
      if (!connection) throw fastify.httpErrors.notFound("No SES connection");
      return connection;
    },
  );

  fastify.delete(
    "/",
    {
      schema: {
        summary: "Remove the SES connection",
        tags: ["SES connection"],
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const removed = await fastify.services.sesConnections.remove(request.apiKey!.organizationId);
      if (!removed) throw fastify.httpErrors.notFound("No SES connection");
      return reply.code(204).send(null);
    },
  );
};

export default sesConnectionRoutes;
