import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  ProviderConnectionSchema,
  ProviderInputSchema,
  RedriveEventsSchema,
  SavedProviderConnectionSchema,
  SetUpEventsSchema,
} from "../schemas/provider-connections.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Provider"];

export const providerRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    fastify.put(
      "/",
      {
        config: scope.config(["provider:connect"]),
        schema: {
          summary: "Connect your email provider",
          description:
            "Checks the credentials with the provider, then stores the secret encrypted. Replaces any existing connection.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: ProviderInputSchema,
          response: { 200: SavedProviderConnectionSchema },
        },
      },
      async (request) => fastify.services.providerConnections.save(scope.organizationId(request), request.body),
    );

    fastify.post(
      "/events",
      {
        config: scope.config(["provider:connect"]),
        schema: {
          summary: "Set up delivery events",
          description:
            "Configures the provider to report delivered, bounced and complained events. push: the provider calls this server's public https address. pull: events wait in a queue in your provider account and the worker reads them, so no public address is needed. Switching modes keeps both subscriptions until the new one works. Safe to run again.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: SetUpEventsSchema,
          response: { 200: ProviderConnectionSchema },
        },
      },
      async (request) => fastify.services.providerConnections.setUpEvents(scope.organizationId(request), request.body),
    );

    fastify.post(
      "/events/redrive",
      {
        config: scope.config(["provider:connect"]),
        schema: {
          summary: "Retry events that were set aside",
          description:
            "In pull mode, moves events that failed 10 times from the dead-letter queue back to the event queue.",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 202: RedriveEventsSchema },
        },
      },
      async (request, reply) =>
        reply.code(202).send(await fastify.services.providerConnections.redriveEvents(scope.organizationId(request))),
    );

    fastify.get(
      "/",
      {
        config: scope.config(["provider:view"]),
        schema: {
          summary: "Get the email provider connection",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 200: ProviderConnectionSchema },
        },
      },
      async (request) => {
        const connection = await fastify.services.providerConnections.get(scope.organizationId(request));
        if (!connection) throw fastify.httpErrors.notFound("No email provider connected");
        return connection;
      },
    );

    fastify.delete(
      "/",
      {
        config: scope.config(["provider:disconnect"]),
        schema: {
          summary: "Disconnect the email provider",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 204: Type.Null() },
        },
      },
      async (request, reply) => {
        const removed = await fastify.services.providerConnections.remove(scope.organizationId(request));
        if (!removed) throw fastify.httpErrors.notFound("No email provider connected");
        return reply.code(204).send(null);
      },
    );
  };
