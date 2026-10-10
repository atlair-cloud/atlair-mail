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

const nullable = <T extends Parameters<typeof Type.Union>[0][number]>(schema: T, description?: string) =>
  Type.Union([schema, Type.Null()], description ? { description } : {});

const ProviderEventsSchema = Type.Object(
  {
    mode: nullable(Type.Enum(["push", "pull"]), "push: the provider calls this server. pull: the worker reads a queue."),
    url: nullable(Type.String(), "In push mode, the public address registered with POST /service/web/provider/events."),
    status: Type.Enum(["disabled", "pending_confirmation", "confirmed", "failing"], {
      description:
        "pending_confirmation until the provider confirms the subscription; the provider drops subscriptions still pending after three days. failing when the worker cannot read the queue; see lastError.",
    }),
    confirmedAt: nullable(DateTime()),
    lastReceivedAt: nullable(DateTime(), "In pull mode, when the worker last received an event."),
    lastError: nullable(Type.String(), "In pull mode, why the last poll failed, for example ATL_PROVIDER_REJECTED: AccessDenied."),
    backlog: nullable(Type.Integer(), "In pull mode, events waiting in the queue, refreshed every few minutes."),
    deadLetters: nullable(
      Type.Integer(),
      "In pull mode, events that failed 10 times and were set aside. Move them back with POST /service/web/provider/events/redrive.",
    ),
  },
  { description: "Delivery events: delivered, bounced and complained." },
);

export const SetUpEventsSchema = Type.Object(
  {
    mode: Type.Optional(
      Type.Enum(["push", "pull"], {
        description:
          "push (default) needs url, this server's public https address. pull needs no public address: the worker reads events from a queue in your provider account.",
      }),
    ),
    url: Type.Optional(
      Type.String({
        maxLength: 2048,
        pattern: "^https://[^\\s?#]+$",
        description:
          "For push: this server's public https address, for example https://mail.example.com. Send the same url again to repair the setup; a new url re-subscribes.",
        examples: ["https://mail.example.com"],
      }),
    ),
  },
  { additionalProperties: false },
);

export const RedriveEventsSchema = Type.Object({
  status: Type.Literal("started", {
    description: "Events set aside are being moved back to the queue; the worker picks them up as they arrive.",
  }),
});

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
