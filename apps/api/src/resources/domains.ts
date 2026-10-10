import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import { CreateDomainSchema, DomainSchema } from "../schemas/domains.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Domains"];

export const domainRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    const params = scope.params({ id: Uuid() });

    fastify.post(
      "/",
      {
        config: scope.config(["domain:create"]),
        schema: {
          summary: "Add a sending domain",
          description: "Registers the domain with your email provider and returns the DNS records to publish.",
          tags,
          ...scope.security,
          params: scope.params(),
          body: CreateDomainSchema,
          response: { 201: DomainSchema },
        },
      },
      async (request, reply) => {
        const domain = await fastify.services.domains.create(scope.organizationId(request), request.body, scope.actor(request));
        return reply.code(201).send(domain);
      },
    );

    fastify.get(
      "/",
      {
        config: scope.config(["domain:view"]),
        schema: {
          summary: "List domains",
          tags,
          ...scope.security,
          params: scope.params(),
          response: { 200: Type.Object({ data: Type.Array(DomainSchema) }) },
        },
      },
      async (request) => ({ data: await fastify.services.domains.list(scope.organizationId(request)) }),
    );

    fastify.get(
      "/:id",
      {
        config: scope.config(["domain:view"]),
        schema: {
          summary: "Get a domain",
          description: "Returns the stored status. Use the verify route to check with the provider again.",
          tags,
          ...scope.security,
          params,
          response: { 200: DomainSchema },
        },
      },
      async (request) => {
        const domain = await fastify.services.domains.get(scope.organizationId(request), request.params.id);
        if (!domain) throw fastify.httpErrors.notFound("Domain not found");
        return domain;
      },
    );

    fastify.post(
      "/:id/verify",
      {
        config: scope.config(["domain:verify"]),
        schema: {
          summary: "Check the domain's verification with the provider",
          tags,
          ...scope.security,
          params,
          response: { 200: DomainSchema },
        },
      },
      async (request) => {
        const domain = await fastify.services.domains.verify(scope.organizationId(request), request.params.id, scope.actor(request));
        if (!domain) throw fastify.httpErrors.notFound("Domain not found");
        return domain;
      },
    );

    fastify.delete(
      "/:id",
      {
        config: scope.config(["domain:delete"]),
        schema: {
          summary: "Remove a domain",
          description: "Removes the domain from atlair-mail. It stays registered in your provider account.",
          tags,
          ...scope.security,
          params,
          response: { 204: Type.Null() },
        },
      },
      async (request, reply) => {
        const removed = await fastify.services.domains.remove(scope.organizationId(request), request.params.id);
        if (!removed) throw fastify.httpErrors.notFound("Domain not found");
        return reply.code(204).send(null);
      },
    );
  };
