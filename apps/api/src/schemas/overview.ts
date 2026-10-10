import { Type } from "typebox";
import { domainStatuses, emailStatuses } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";
import { EmailSummarySchema } from "./emails.ts";

const nullable = <T extends Parameters<typeof Type.Union>[0][number]>(schema: T) => Type.Union([schema, Type.Null()]);

const StatusCountsSchema = Type.Object(
  {
    total: Type.Integer(),
    ...Object.fromEntries(emailStatuses.map((status) => [status, Type.Integer()])),
  },
  { description: "Emails created in the window, by current status." },
);

const AttentionItemSchema = Type.Object({
  kind: Type.Enum([
    "domain_failed",
    "domain_pending",
    "events_not_connected",
    "events_error",
    "bounce_rate",
    "complaint_rate",
    "emails_failed",
    "webhook_failing",
  ]),
  severity: Type.Enum(["warning", "critical"]),
  title: Type.String(),
  detail: Type.String(),
  targetId: nullable(Uuid()),
});

export const OverviewSchema = Type.Object({
  generatedAt: DateTime(),
  health: Type.Enum(["setup", "ok", "warning", "critical"], {
    description: "setup until a provider is connected, a domain is verified and an email was sent; then the worst attention item.",
  }),
  setup: Type.Object({
    provider: Type.Object({
      connected: Type.Boolean(),
      provider: nullable(Type.String()),
      region: nullable(Type.String()),
      eventsConnected: Type.Boolean(),
    }),
    domains: Type.Object({
      total: Type.Integer(),
      verified: Type.Integer(),
      pending: Type.Integer(),
      failed: Type.Integer(),
    }),
    apiKeys: Type.Integer({ description: "Active API keys." }),
    webhooks: Type.Integer({ description: "Enabled webhook endpoints." }),
    suppressions: Type.Integer(),
    members: Type.Integer(),
    firstEmailSent: Type.Boolean(),
  }),
  metrics: Type.Object({
    last24h: StatusCountsSchema,
    last7d: StatusCountsSchema,
    daily: Type.Array(Type.Object({ day: Type.String({ description: "UTC date, YYYY-MM-DD." }), counts: StatusCountsSchema }), {
      description: "Seven UTC days, oldest first, ending today.",
    }),
    rates: Type.Object(
      {
        delivery: nullable(Type.Number()),
        bounce: nullable(Type.Number()),
        complaint: nullable(Type.Number()),
      },
      { description: "Over the seven days, as a share of emails the provider accepted. null with nothing accepted." },
    ),
    latestEmailAt: nullable(DateTime()),
  }),
  attention: Type.Array(AttentionItemSchema, { description: "Problems to fix, critical first. Empty when all is well." }),
  domains: Type.Array(
    Type.Object({ id: Uuid(), name: Type.String(), status: Type.Enum(domainStatuses), lastCheckedAt: nullable(DateTime()) }),
  ),
  recentEmails: Type.Array(EmailSummarySchema),
});
