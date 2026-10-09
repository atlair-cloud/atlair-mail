import { Type } from "typebox";
import { webhookDeliveryStatuses, webhookEventTypes } from "@atlair-mail/db";
import { maxPublicUrlLength } from "@atlair-mail/core";
import { DateTime, Uuid } from "../lib/schemas.ts";
import { maxDeliveryPageSize } from "../services/webhooks.ts";

const Url = Type.String({
  minLength: 9,
  maxLength: maxPublicUrlLength,
  pattern: "^https://",
  examples: ["https://example.com/webhooks/atlair-mail"],
});

const EventTypes = Type.Array(Type.Enum(webhookEventTypes), {
  minItems: 1,
  maxItems: webhookEventTypes.length,
  uniqueItems: true,
  examples: [["email.delivered", "email.bounced", "email.complained"]],
});

export const WebhookSchema = Type.Object({
  id: Uuid(),
  url: Type.String(),
  eventTypes: Type.Array(Type.Enum(webhookEventTypes)),
  enabled: Type.Boolean(),
  createdAt: DateTime(),
  updatedAt: DateTime(),
});

export const CreatedWebhookSchema = Type.Object({
  ...WebhookSchema.properties,
  signingSecret: Type.String({
    description: "Shown only once. Use it to verify the webhook-signature header of each request.",
  }),
});

export const WebhookListSchema = Type.Object({ data: Type.Array(WebhookSchema) });

export const CreateWebhookSchema = Type.Object({ url: Url, eventTypes: EventTypes }, { additionalProperties: false });

export const UpdateWebhookSchema = Type.Object(
  {
    url: Type.Optional(Url),
    eventTypes: Type.Optional(EventTypes),
    enabled: Type.Optional(
      Type.Boolean({ description: "Disabled endpoints receive nothing; their pending deliveries fail." }),
    ),
  },
  { additionalProperties: false },
);

export const WebhookDeliverySchema = Type.Object({
  id: Type.String({ format: "uuid", description: "Sent as the webhook-id header; the same on every retry." }),
  eventType: Type.Enum(webhookEventTypes),
  emailId: Uuid(),
  status: Type.Enum(webhookDeliveryStatuses),
  attempts: Type.Integer(),
  nextAttemptAt: Type.Union([DateTime(), Type.Null()]),
  lastResponseStatus: Type.Union([Type.Integer(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()]),
  deliveredAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
});

export const WebhookDeliveryQuerySchema = Type.Object({
  before: Type.Optional(
    Type.String({ format: "uuid", description: "Return deliveries older than this id, the last id of the previous page." }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: maxDeliveryPageSize, default: 50 })),
});

export const WebhookDeliveryListSchema = Type.Object({
  data: Type.Array(WebhookDeliverySchema),
  hasMore: Type.Boolean(),
});
