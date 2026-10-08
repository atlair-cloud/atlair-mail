import { Type } from "typebox";
import { emailStatuses } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";
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
  subject: Type.String({ minLength: 1, maxLength: 998, pattern: noControlCharacters }),
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
  scheduledAt: DateTime(),
  sentAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
  updatedAt: DateTime(),
});
