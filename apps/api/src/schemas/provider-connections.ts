import { Type } from "typebox";
import { DateTime, Uuid } from "../lib/schemas.ts";

const SesInputSchema = Type.Object(
  {
    type: Type.Literal("ses"),
    region: Type.String({ pattern: "^[a-z]{2}(-[a-z]+)+-\\d+$", examples: ["us-east-1"] }),
    accessKeyId: Type.String({ pattern: "^[A-Z0-9]{16,128}$" }),
    secretAccessKey: Type.String({ minLength: 1, maxLength: 256, writeOnly: true }),
  },
  { title: "Amazon SES" },
);

export const ProviderInputSchema = Type.Union([SesInputSchema], {
  description: "The provider's credentials, tagged by type. The secret is stored encrypted and never returned.",
});

const ProviderEventsSchema = Type.Object(
  {
    url: Type.Union([Type.String(), Type.Null()], {
      description: "The public address registered with POST /v1/provider/events.",
    }),
    status: Type.Enum(["disabled", "pending_confirmation", "confirmed"], {
      description:
        "pending_confirmation until the provider reaches this server and the subscription is confirmed. The provider drops subscriptions still pending after three days; register again if that happens.",
    }),
    confirmedAt: Type.Union([DateTime(), Type.Null()]),
  },
  { description: "Delivery events: delivered, bounced and complained." },
);

export const SetUpEventsSchema = Type.Object(
  {
    url: Type.String({
      maxLength: 2048,
      pattern: "^https://[^\\s?#]+$",
      description:
        "This server's public https address, for example https://mail.example.com. Send the same url again to repair the setup; a new url re-subscribes.",
      examples: ["https://mail.example.com"],
    }),
  },
  { additionalProperties: false },
);

const SesConnectionSchema = Type.Object(
  {
    id: Uuid(),
    type: Type.Literal("ses"),
    region: Type.String(),
    accessKeyId: Type.String(),
    events: ProviderEventsSchema,
    createdAt: DateTime(),
    updatedAt: DateTime(),
  },
  { title: "Amazon SES" },
);

export const ProviderConnectionSchema = Type.Union([SesConnectionSchema]);

export const ProviderAccountSchema = Type.Object({
  sendingEnabled: Type.Boolean(),
  sandbox: Type.Boolean({
    description: "True while the provider account can only send to verified recipients.",
  }),
  dailyQuota: Type.Number(),
  maxSendRate: Type.Number({ description: "Messages per second." }),
});

export const SavedProviderConnectionSchema = Type.Union([
  Type.Object({ ...SesConnectionSchema.properties, account: ProviderAccountSchema }, { title: "Amazon SES" }),
]);
