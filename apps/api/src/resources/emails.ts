import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../lib/schemas.ts";
import {
  EmailEventSchema,
  EmailListQuerySchema,
  EmailSchema,
  EmailSummarySchema,
  QueuedEmailSchema,
  SendEmailHeadersSchema,
  SendEmailSchema,
} from "../schemas/emails.ts";
import { toPublicEmailEvent } from "../services/email-events.ts";
import { toPublicEmail, toQueuedEmail } from "../services/emails.ts";
import type { ResourceScope } from "./scope.ts";

const tags = ["Emails"];

export const emailRoutes =
  (scope: ResourceScope): FastifyPluginAsyncTypebox =>
  async (fastify) => {
    fastify.post(
      "/",
      {
        bodyLimit: 5 * 1024 * 1024,
        config: scope.config(["email:send"], "sending_access"),
        schema: {
          summary: "Send an email",
          description:
            "Queues the email and returns immediately. The From domain must be verified. Send an Idempotency-Key header to retry safely.",
          tags,
          ...scope.security,
          params: scope.params(),
          headers: SendEmailHeadersSchema,
          body: SendEmailSchema,
          response: { 202: QueuedEmailSchema },
        },
      },
      async (request, reply) => {
        const { email, replayed } = await fastify.services.emails.send(request.body, {
          organizationId: scope.organizationId(request),
          apiKeyId: scope.apiKeyId(request),
          idempotencyKey: request.headers["idempotency-key"],
        });
        if (replayed) reply.header("idempotent-replayed", "true");
        return reply.code(202).send(toQueuedEmail(email));
      },
    );

    fastify.get(
      "/",
      {
        config: scope.config(["email:view"], "sending_access"),
        schema: {
          summary: "List emails",
          description:
            "Newest first, without bodies; pass the last id as before to get the next page, and status to filter.",
          tags,
          ...scope.security,
          params: scope.params(),
          querystring: EmailListQuerySchema,
          response: { 200: Type.Object({ data: Type.Array(EmailSummarySchema) }) },
        },
      },
      async (request) => ({ data: await fastify.services.emails.list(scope.organizationId(request), request.query) }),
    );

    fastify.get(
      "/:id",
      {
        config: scope.config(["email:view"], "sending_access"),
        schema: {
          summary: "Get an email",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          response: { 200: EmailSchema },
        },
      },
      async (request) => {
        const email = await fastify.services.emails.get(scope.organizationId(request), request.params.id);
        if (!email) throw fastify.httpErrors.notFound("Email not found");
        return toPublicEmail(email);
      },
    );

    fastify.get(
      "/:id/events",
      {
        config: scope.config(["email:view"], "sending_access"),
        schema: {
          summary: "List an email's events",
          description:
            "Delivery events reported by the provider, oldest first, with per-recipient detail. Status changes only move forward, so a late or repeated event never undoes a newer one.",
          tags,
          ...scope.security,
          params: scope.params({ id: Uuid() }),
          response: { 200: Type.Object({ data: Type.Array(EmailEventSchema) }) },
        },
      },
      async (request) => {
        const events = await fastify.services.emailEvents.list(scope.organizationId(request), request.params.id);
        if (!events) throw fastify.httpErrors.notFound("Email not found");
        return { data: events.map(toPublicEmailEvent) };
      },
    );
  };
