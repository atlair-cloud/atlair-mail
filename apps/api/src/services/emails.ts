import { createHash } from "node:crypto";
import createError from "@fastify/error";
import { stringify } from "safe-stable-stringify";
import {
  findDomainByName,
  findEmailByIdempotencyKey,
  findEmailInOrganization,
  findSuppressedAddresses,
  insertEmail,
  type Database,
} from "@atlair-mail/db";
import type { Email } from "@atlair-mail/db/schema";
import { formatMailbox, parseMailbox, type Mailbox } from "@atlair-mail/core";
import { findInvalidHeaderNames, findReservedHeaders } from "../lib/email-headers.ts";

export const InvalidAddressError = createError(
  "ATL_INVALID_ADDRESS",
  "Invalid %s address. Use a single address such as hello@example.com or Name <hello@example.com>",
  400,
);
export const TooManyRecipientsError = createError(
  "ATL_TOO_MANY_RECIPIENTS",
  "An email can have at most %d recipients across to, cc and bcc",
  400,
);
export const BodyRequiredError = createError("ATL_BODY_REQUIRED", "Provide html, text, or both", 400);
export const ReservedHeaderError = createError(
  "ATL_RESERVED_HEADER",
  "These headers are set by atlair-mail and cannot be overridden: %s",
  400,
);
export const InvalidHeaderNameError = createError(
  "ATL_INVALID_HEADER_NAME",
  "Header names must be printable ASCII without spaces or colons",
  400,
);
export const ScheduleTooFarError = createError(
  "ATL_SCHEDULE_TOO_FAR",
  "scheduledAt can be at most %d days ahead",
  400,
);
export const DomainNotVerifiedError = createError(
  "ATL_DOMAIN_NOT_VERIFIED",
  "%s is not a verified domain. Add it with POST /v1/domains and check it with POST /v1/domains/:id/verify",
  422,
);
export const RecipientSuppressedError = createError(
  "ATL_RECIPIENT_SUPPRESSED",
  "These recipients are suppressed after a bounce or complaint: %s",
  422,
);
export const IdempotencyKeyReusedError = createError(
  "ATL_IDEMPOTENCY_KEY_REUSED",
  "This Idempotency-Key was already used with a different request",
  422,
);

export const maxRecipients = 50;
export const maxScheduleDays = 30;

export interface SendEmailInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  scheduledAt?: string;
}

export interface SendEmailContext {
  organizationId: string;
  apiKeyId: string;
  idempotencyKey?: string;
}

function parseList(field: string, inputs: string[] = []) {
  return inputs.map((input) => parseMailbox(input) ?? fail(new InvalidAddressError(field)));
}

function fail(error: Error): never {
  throw error;
}

function resolveSendAt(scheduledAt: string | undefined, now: Date) {
  if (!scheduledAt) return now;
  const requested = new Date(scheduledAt);
  if (requested.getTime() - now.getTime() > maxScheduleDays * 86_400_000) {
    throw new ScheduleTooFarError(maxScheduleDays);
  }
  return requested < now ? now : requested;
}

export const toQueuedEmail = (email: Email) => ({
  id: email.id,
  status: email.status,
  scheduledAt: email.sendAt,
  createdAt: email.createdAt,
});

export const toPublicEmail = (email: Email) => ({
  id: email.id,
  status: email.status,
  from: email.fromAddress,
  to: email.toAddresses,
  cc: email.ccAddresses,
  bcc: email.bccAddresses,
  replyTo: email.replyToAddresses,
  subject: email.subject,
  html: email.htmlBody,
  text: email.textBody,
  headers: email.headers,
  tags: email.tags,
  providerMessageId: email.providerMessageId,
  scheduledAt: email.sendAt,
  sentAt: email.sentAt,
  createdAt: email.createdAt,
  updatedAt: email.updatedAt,
});

export function createEmailService(db: Database) {
  async function replay(organizationId: string, idempotencyKey: string, fingerprint: string) {
    const existing = await findEmailByIdempotencyKey(db, organizationId, idempotencyKey);
    if (!existing) return null;
    if (existing.requestFingerprint !== fingerprint) throw new IdempotencyKeyReusedError();
    return existing;
  }

  return {
    async send(input: SendEmailInput, context: SendEmailContext) {
      const from = parseMailbox(input.from) ?? fail(new InvalidAddressError("from"));
      const to = parseList("to", input.to);
      const cc = parseList("cc", input.cc);
      const bcc = parseList("bcc", input.bcc);
      const replyTo = parseList("replyTo", input.replyTo);
      const recipients: Mailbox[] = [...to, ...cc, ...bcc];
      if (recipients.length > maxRecipients) throw new TooManyRecipientsError(maxRecipients);
      if (input.html === undefined && input.text === undefined) throw new BodyRequiredError();
      const headers = input.headers ?? {};
      if (findInvalidHeaderNames(headers).length > 0) throw new InvalidHeaderNameError();
      const reserved = findReservedHeaders(headers);
      if (reserved.length > 0) throw new ReservedHeaderError(reserved.join(", "));
      const sendAt = resolveSendAt(input.scheduledAt, new Date());

      const normalized = {
        from: formatMailbox(from),
        to: to.map(formatMailbox),
        cc: cc.map(formatMailbox),
        bcc: bcc.map(formatMailbox),
        replyTo: replyTo.map(formatMailbox),
        subject: input.subject,
        html: input.html ?? null,
        text: input.text ?? null,
        headers,
        tags: input.tags ?? [],
        scheduledAt: input.scheduledAt ?? null,
      };
      const { organizationId, idempotencyKey } = context;
      const fingerprint = idempotencyKey
        ? createHash("sha256").update(stringify(normalized) ?? "").digest("hex")
        : null;

      if (idempotencyKey && fingerprint) {
        const existing = await replay(organizationId, idempotencyKey, fingerprint);
        if (existing) return { email: existing, replayed: true };
      }

      const domain = await findDomainByName(db, organizationId, from.domain);
      if (!domain || domain.status !== "verified") throw new DomainNotVerifiedError(from.domain);

      const suppressed = await findSuppressedAddresses(
        db,
        organizationId,
        recipients.map((recipient) => recipient.address),
      );
      if (suppressed.length > 0) throw new RecipientSuppressedError(suppressed.join(", "));

      const email = await insertEmail(db, {
        organizationId,
        apiKeyId: context.apiKeyId,
        domainId: domain.id,
        fromAddress: normalized.from,
        toAddresses: normalized.to,
        ccAddresses: normalized.cc,
        bccAddresses: normalized.bcc,
        replyToAddresses: normalized.replyTo,
        subject: normalized.subject,
        htmlBody: normalized.html,
        textBody: normalized.text,
        headers: normalized.headers,
        tags: normalized.tags,
        sendAt,
        idempotencyKey: idempotencyKey ?? null,
        requestFingerprint: fingerprint,
      });
      if (email) return { email, replayed: false };

      const raced = await replay(organizationId, idempotencyKey!, fingerprint!);
      return { email: raced!, replayed: true };
    },

    get: (organizationId: string, id: string) => findEmailInOrganization(db, { id, organizationId }),
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
