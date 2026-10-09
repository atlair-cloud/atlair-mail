import { emailIdTag, providerEventKey } from "../events.ts";
import type { BounceKind, EmailEventDetails, EmailEventType, EventRecipient, ProviderEvent } from "../types.ts";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const list = (value: unknown) => (Array.isArray(value) ? value : []);

const sesEventTypes = new Map<unknown, { type: EmailEventType; detail: string }>([
  ["Send", { type: "sent", detail: "send" }],
  ["Delivery", { type: "delivered", detail: "delivery" }],
  ["Bounce", { type: "bounced", detail: "bounce" }],
  ["Complaint", { type: "complained", detail: "complaint" }],
  ["Reject", { type: "rejected", detail: "reject" }],
  ["DeliveryDelay", { type: "delivery_delayed", detail: "deliveryDelay" }],
  ["Open", { type: "opened", detail: "open" }],
  ["Click", { type: "clicked", detail: "click" }],
]);

const bounceKinds = new Map<unknown, BounceKind>([
  ["Permanent", "permanent"],
  ["Transient", "transient"],
]);

const toRecipient = (entry: unknown): EventRecipient | null => {
  if (typeof entry === "string") return { address: entry };
  if (!isRecord(entry)) return null;
  const address = text(entry.emailAddress);
  if (!address) return null;
  const diagnosticCode = text(entry.diagnosticCode);
  return diagnosticCode ? { address, diagnosticCode } : { address };
};

function recipientsOf(detail: Json, mail: Json): EventRecipient[] {
  const reported =
    detail.recipients ?? detail.bouncedRecipients ?? detail.complainedRecipients ?? detail.delayedRecipients;
  const source = reported === undefined ? mail.destination : reported;
  return list(source)
    .map(toRecipient)
    .filter((recipient): recipient is EventRecipient => recipient !== null);
}

function detailsOf(type: EmailEventType, detail: Json, mail: Json): EmailEventDetails {
  const recipients = recipientsOf(detail, mail);
  switch (type) {
    case "delivered": {
      const smtpResponse = text(detail.smtpResponse);
      return smtpResponse ? { recipients, smtpResponse } : { recipients };
    }
    case "bounced":
      return {
        recipients,
        bounce: {
          kind: bounceKinds.get(detail.bounceType) ?? "undetermined",
          subType: text(detail.bounceSubType) ?? "Undetermined",
        },
      };
    case "complained": {
      const feedbackType = text(detail.complaintFeedbackType);
      return { recipients, complaint: feedbackType ? { feedbackType } : {} };
    }
    case "clicked": {
      const link = text(detail.link);
      return link ? { recipients, link } : { recipients };
    }
    default:
      return { recipients };
  }
}

const toDate = (...values: unknown[]) => {
  for (const value of values) {
    const date = typeof value === "string" ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) return date;
  }
  return null;
};

function emailIdOf(mail: Json) {
  const tags = isRecord(mail.tags) ? mail.tags : {};
  const [value] = list(Object.hasOwn(tags, emailIdTag) ? tags[emailIdTag] : undefined);
  return text(value);
}

export interface SesEvent {
  accountId: string | undefined;
  event: ProviderEvent;
}

export function parseSesEvent(message: unknown): SesEvent | null {
  if (!isRecord(message) || !isRecord(message.mail)) return null;
  const mapping = sesEventTypes.get(message.eventType ?? message.notificationType);
  if (!mapping) return null;
  const mail = message.mail;
  const providerMessageId = text(mail.messageId);
  const detail = isRecord(message[mapping.detail]) ? (message[mapping.detail] as Json) : {};
  const occurredAt = toDate(detail.timestamp, mail.timestamp);
  if (!providerMessageId || !occurredAt) return null;

  const details = detailsOf(mapping.type, detail, mail);
  const emailId = emailIdOf(mail);
  return {
    accountId: text(mail.sendingAccountId),
    event: {
      eventKey: providerEventKey({ providerMessageId, type: mapping.type, occurredAt, recipients: details.recipients }),
      providerMessageId,
      ...(emailId && { emailId }),
      type: mapping.type,
      occurredAt,
      details,
    },
  };
}
