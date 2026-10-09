import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { Uuid } from "../../../lib/schemas.ts";
import {
  EmailEventSchema,
  EmailSchema,
  QueuedEmailSchema,
  SendEmailHeadersSchema,
  SendEmailSchema,
} from "../../../schemas/emails.ts";
import { toPublicEmailEvent } from "../../../services/email-events.ts";
import { toPublicEmail, toQueuedEmail } from "../../../services/emails.ts";

const tags = ["Emails"];

const emailRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      bodyLimit: 5 * 1024 * 1024,
      config: { permission: "sending_access" },
      schema: {
        summary: "Send an email",
        description:
          "Queues the email and returns immediately. The From domain must be verified. Send an Idempotency-Key header to retry safely.",
        tags,
        headers: SendEmailHeadersSchema,
        body: SendEmailSchema,
        response: { 202: QueuedEmailSchema },
      },
    },
    async (request, reply) => {
      const { email, replayed } = await fastify.services.emails.send(request.body, {
        organizationId: request.apiKey!.organizationId,
        apiKeyId: request.apiKey!.id,
        idempotencyKey: request.headers["idempotency-key"],
      });
      if (replayed) reply.header("idempotent-replayed", "true");
      return reply.code(202).send(toQueuedEmail(email));
    },
  );

  fastify.get(
    "/:id",
    {
      config: { permission: "sending_access" },
      schema: {
        summary: "Get an email",
        tags,
        params: Type.Object({ id: Uuid() }),
        response: { 200: EmailSchema },
      },
    },
    async (request) => {
      const email = await fastify.services.emails.get(request.apiKey!.organizationId, request.params.id);
      if (!email) throw fastify.httpErrors.notFound("Email not found");
      return toPublicEmail(email);
    },
  );

  fastify.get(
    "/:id/events",
    {
      config: { permission: "sending_access" },
      schema: {
        summary: "List an email's events",
        description:
          "Delivery events reported by the provider, oldest first, with per-recipient detail. Status changes only move forward, so a late or repeated event never undoes a newer one.",
        tags,
        params: Type.Object({ id: Uuid() }),
        response: { 200: Type.Object({ data: Type.Array(EmailEventSchema) }) },
      },
    },
    async (request) => {
      const events = await fastify.services.emailEvents.list(request.apiKey!.organizationId, request.params.id);
      if (!events) throw fastify.httpErrors.notFound("Email not found");
      return { data: events.map(toPublicEmailEvent) };
    },
  );
};

export default emailRoutes;
