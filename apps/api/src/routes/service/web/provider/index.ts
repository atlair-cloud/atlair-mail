import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  ProviderConnectionSchema,
  ProviderInputSchema,
  SavedProviderConnectionSchema,
  RedriveEventsSchema,
  SetUpEventsSchema,
} from "../../../../schemas/provider-connections.ts";

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
          "Configures the provider to report delivered, bounced and complained events. push: the provider calls this server's public https address. pull: events wait in a queue in your provider account and the worker reads them, so no public address is needed. Switching modes keeps both subscriptions until the new one works. Safe to run again.",
        tags,
        body: SetUpEventsSchema,
        response: { 200: ProviderConnectionSchema },
      },
    },
    async (request) => fastify.services.providerConnections.setUpEvents(request.apiKey!.organizationId, request.body),
  );

  fastify.post(
    "/events/redrive",
    {
      schema: {
        summary: "Retry events that were set aside",
        description:
          "In pull mode, moves events that failed 10 times from the dead-letter queue back to the event queue.",
        tags,
        response: { 202: RedriveEventsSchema },
      },
    },
    async (request, reply) =>
      reply.code(202).send(await fastify.services.providerConnections.redriveEvents(request.apiKey!.organizationId)),
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
