import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../lib/schemas.ts";
import { CreateDomainSchema, DomainSchema } from "../../../schemas/domains.ts";

const tags = ["Domains"];
const params = Type.Object({ id: Uuid() });

const domainRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      schema: {
        summary: "Add a sending domain",
        description: "Creates the domain identity in your SES account and returns the DNS records to publish.",
        tags,
        body: CreateDomainSchema,
        response: { 201: DomainSchema },
      },
    },
    async (request, reply) => {
      const domain = await fastify.services.domains.create(request.apiKey!.organizationId, request.body);
      return reply.code(201).send(domain);
    },
  );

  fastify.get(
    "/",
    {
      schema: {
        summary: "List domains",
        tags,
        response: { 200: Type.Object({ data: Type.Array(DomainSchema) }) },
      },
    },
    async (request) => {
      return { data: await fastify.services.domains.list(request.apiKey!.organizationId) };
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "Get a domain",
        description: "Returns the stored status. Use POST /v1/domains/:id/verify to check SES again.",
        tags,
        params,
        response: { 200: DomainSchema },
      },
    },
    async (request) => {
      const domain = await fastify.services.domains.get(request.apiKey!.organizationId, request.params.id);
      if (!domain) throw fastify.httpErrors.notFound("Domain not found");
      return domain;
    },
  );

  fastify.post(
    "/:id/verify",
    {
      schema: {
        summary: "Check the domain's verification with SES",
        tags,
        params,
        response: { 200: DomainSchema },
      },
    },
    async (request) => {
      const domain = await fastify.services.domains.verify(request.apiKey!.organizationId, request.params.id);
      if (!domain) throw fastify.httpErrors.notFound("Domain not found");
      return domain;
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        summary: "Remove a domain",
        description: "Removes the domain from atlair-mail. The identity stays in your SES account.",
        tags,
        params,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const removed = await fastify.services.domains.remove(request.apiKey!.organizationId, request.params.id);
      if (!removed) throw fastify.httpErrors.notFound("Domain not found");
      return reply.code(204).send(null);
    },
  );
};

export default domainRoutes;
