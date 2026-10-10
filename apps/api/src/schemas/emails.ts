import { Type } from "typebox";
import { emailEventTypes, emailStatuses } from "@atlair-mail/db";
import { bounceKinds } from "@atlair-mail/providers/types";
import { DateTime, Uuid } from "../lib/schemas.ts";
import { CreatedBySchema } from "./authors.ts";
import { EmailTemplateSchema } from "./templates.ts";
import { maxRecipients } from "../services/emails.ts";

const noControlCharacters = "^[^\\u0000-\\u001f\\u007f]*$";
const headerName = "^[!-9;-~]{1,100}$";

const Address = Type.String({
  minLength: 3,
  maxLength: 320,
  pattern: noControlCharacters,
  examples: ["Acme <hello@acme.com>"],
});

const AddressList = (maxItems: number) => Type.Array(Address, { maxItems });


export const SendEmailSchema = Type.Object({
  from: Address,
  to: Type.Array(Address, { minItems: 1, maxItems: maxRecipients }),
  cc: Type.Optional(AddressList(maxRecipients)),
  bcc: Type.Optional(AddressList(maxRecipients)),
  replyTo: Type.Optional(AddressList(10)),
  subject: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: 998,
      pattern: noControlCharacters,
      description: "Required unless you send a template; with one, it replaces the template's subject.",
    }),
  ),
  template: Type.Optional(EmailTemplateSchema),
  html: Type.Optional(Type.String({ minLength: 1, maxLength: 4_000_000 })),
  text: Type.Optional(Type.String({ minLength: 1, maxLength: 1_000_000 })),
  headers: Type.Optional(
    Type.Record(
      Type.String({ pattern: headerName }),
      Type.String({ maxLength: 2_000, pattern: noControlCharacters }),
      { maxProperties: 50, propertyNames: { pattern: headerName } },
    ),
  ),
  tags: Type.Optional(
    Type.Array(
      Type.Object({
        name: Type.String({ pattern: "^[A-Za-z0-9_-]{1,256}$" }),
        value: Type.String({ pattern: "^[A-Za-z0-9_-]{1,256}$" }),
      }),
      { maxItems: 10 },
    ),
  ),
  scheduledAt: Type.Optional(
    Type.String({ format: "date-time", description: "Send at this time, up to 30 days ahead. Defaults to now." }),
  ),
});

export const SendEmailHeadersSchema = Type.Object({
  "idempotency-key": Type.Optional(
    Type.String({
      pattern: "^[!-~]{1,255}$",
      description: "Retrying with the same key returns the same email instead of sending twice.",
    }),
  ),
});

export const QueuedEmailSchema = Type.Object({
  id: Uuid(),
  status: Type.Enum(emailStatuses),
  scheduledAt: DateTime(),
  createdAt: DateTime(),
});

export const EmailSchema = Type.Object({
  id: Uuid(),
  status: Type.Enum(emailStatuses),
  from: Type.String(),
  to: Type.Array(Type.String()),
  cc: Type.Array(Type.String()),
  bcc: Type.Array(Type.String()),
  replyTo: Type.Array(Type.String()),
  subject: Type.String(),
  html: Type.Union([Type.String(), Type.Null()]),
  text: Type.Union([Type.String(), Type.Null()]),
  headers: Type.Record(Type.String(), Type.String()),
  tags: Type.Array(Type.Object({ name: Type.String(), value: Type.String() })),
  providerMessageId: Type.Union([Type.String(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()], {
    description: "Why the last attempt failed, for example ATL_PROVIDER_REJECTED: MessageRejected.",
  }),
  scheduledAt: DateTime(),
  sentAt: Type.Union([DateTime(), Type.Null()]),
  template: Type.Union([Type.Object({ id: Uuid(), version: Type.Union([Type.Integer(), Type.Null()]) }), Type.Null()], {
    description: "The template it was sent with, and the published version used. version is null for a test send of the draft.",
  }),
  ...CreatedBySchema,
  updatedAt: DateTime(),
});

export const EmailEventSchema = Type.Object({
  id: Uuid(),
  type: Type.Enum(emailEventTypes),
  occurredAt: DateTime(),
  recipients: Type.Array(
    Type.Object({ address: Type.String(), diagnosticCode: Type.Optional(Type.String()) }),
  ),
  bounce: Type.Optional(Type.Object({ kind: Type.Enum(bounceKinds), subType: Type.String() })),
  complaint: Type.Optional(Type.Object({ feedbackType: Type.Optional(Type.String()) })),
  smtpResponse: Type.Optional(Type.String()),
  link: Type.Optional(Type.String()),
  error: Type.Optional(
    Type.String({ description: "On failed events: why atlair-mail gave up, for example ATL_RECIPIENT_SUPPRESSED." }),
  ),
});

export const maxEmailPageSize = 100;

export const EmailListQuerySchema = Type.Object({
  status: Type.Optional(Type.Enum(emailStatuses)),
  before: Type.Optional(
    Type.String({ format: "uuid", description: "Return emails older than this id, the last id of the previous page." }),
  ),
  search: Type.Optional(
    Type.String({ minLength: 1, maxLength: 200, description: "Match the subject or a recipient, ignoring case." }),
  ),
  since: Type.Optional(Type.String({ format: "date-time", description: "Only emails created at or after this time." })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: maxEmailPageSize, default: 50 })),
});

export const EmailSummarySchema = Type.Object({
  id: Uuid(),
  status: Type.Enum(emailStatuses),
  from: Type.String(),
  to: Type.Array(Type.String()),
  subject: Type.String(),
  scheduledAt: DateTime(),
  sentAt: Type.Union([DateTime(), Type.Null()]),
  lastError: Type.Union([Type.String(), Type.Null()], { description: "Why it failed, for failed emails." }),
  ...CreatedBySchema,
});
