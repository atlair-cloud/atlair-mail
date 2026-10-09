import { createHash } from "node:crypto";
import type { EmailEventDetails, EmailEventType, EventRecipient } from "./types.ts";

export const eventLimits = {
  recipients: 50,
  address: 320,
  name: 64,
  text: 1000,
  link: 2048,
} as const;

const controlCharacters = /[\u0000-\u001F\u007F]/g;

const bound = (value: string, max: number) => value.replace(controlCharacters, "").slice(0, max);

const optional = <K extends string>(key: K, value: string | undefined, max: number) =>
  value === undefined ? {} : ({ [key]: bound(value, max) } as { [P in K]?: string });

export interface EventKeyParts {
  providerMessageId: string;
  type: EmailEventType;
  occurredAt: Date;
  recipients: Pick<EventRecipient, "address">[];
}

export function providerEventKey(parts: EventKeyParts) {
  const recipients = parts.recipients.map((recipient) => recipient.address.toLowerCase()).sort();
  const material = JSON.stringify([parts.providerMessageId, parts.type, parts.occurredAt.toISOString(), recipients]);
  return createHash("sha256").update(material).digest("hex");
}

export function boundEventDetails(details: EmailEventDetails): EmailEventDetails {
  return {
    recipients: details.recipients.slice(0, eventLimits.recipients).map((recipient) => ({
      address: bound(recipient.address, eventLimits.address),
      ...optional("diagnosticCode", recipient.diagnosticCode, eventLimits.text),
    })),
    ...(details.bounce && {
      bounce: { kind: details.bounce.kind, subType: bound(details.bounce.subType, eventLimits.name) },
    }),
    ...(details.complaint && {
      complaint: optional("feedbackType", details.complaint.feedbackType, eventLimits.name),
    }),
    ...optional("smtpResponse", details.smtpResponse, eventLimits.text),
    ...optional("link", details.link, eventLimits.link),
  };
}
