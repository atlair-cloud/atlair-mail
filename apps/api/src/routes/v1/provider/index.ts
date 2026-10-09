import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  ProviderConnectionSchema,
  ProviderInputSchema,
  SavedProviderConnectionSchema,
  SetUpEventsSchema,
} from "../../../schemas/provider-connections.ts";

const tags = ["Provider"];

const providerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.put(
    "/",
    {
      schema: {
        summary: "Connect your email provider",
        description:
          "Checks the credentials with the provider, then stores the secret encrypted. Replaces any existing connection.",
        tags,
        body: ProviderInputSchema,
        response: { 200: SavedProviderConnectionSchema },
      },
    },
    async (request) => {
      return fastify.services.providerConnections.save(request.apiKey!.organizationId, request.body);
    },
  );

  fastify.post(
    "/events",
    {
      schema: {
        summary: "Set up delivery events",
        description:
          "Registers this server's public https address and configures the provider to report delivered, bounced and complained events to it. Safe to run again.",
        tags,
        body: SetUpEventsSchema,
        response: { 200: ProviderConnectionSchema },
      },
    },
    async (request) =>
      fastify.services.providerConnections.setUpEvents(request.apiKey!.organizationId, request.body.url),
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "Get the email provider connection",
        tags,
        response: { 200: ProviderConnectionSchema },
      },
    },
    async (request) => {
      const connection = await fastify.services.providerConnections.get(request.apiKey!.organizationId);
      if (!connection) throw fastify.httpErrors.notFound("No email provider connected");
      return connection;
    },
  );

  fastify.delete(
    "/",
    {
      schema: {
        summary: "Disconnect the email provider",
        tags,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const removed = await fastify.services.providerConnections.remove(request.apiKey!.organizationId);
      if (!removed) throw fastify.httpErrors.notFound("No email provider connected");
      return reply.code(204).send(null);
    },
  );
};

export default providerRoutes;
