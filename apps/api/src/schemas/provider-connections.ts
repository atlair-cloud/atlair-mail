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

const SesConnectionSchema = Type.Object(
  {
    id: Uuid(),
    type: Type.Literal("ses"),
    region: Type.String(),
    accessKeyId: Type.String(),
    eventsEnabled: Type.Boolean({
      description: "True once delivery events are set up. The provider then reports delivered, bounced and complained.",
    }),
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
  Type.Object(
    {
      ...SesConnectionSchema.properties,
      account: ProviderAccountSchema,
      eventsError: Type.Union([Type.String(), Type.Null()], {
        description: "Why delivery events could not be set up, for example a missing permission. Saving still succeeds.",
      }),
    },
    { title: "Amazon SES" },
  ),
]);
