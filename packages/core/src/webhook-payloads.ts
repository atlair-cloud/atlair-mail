import type { EmailEventPayload, EmailEventType, WebhookPayload } from "@atlair-mail/db/types";

export interface WebhookEmail {
  id: string;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
}

export interface WebhookEvent {
  type: EmailEventType;
  occurredAt: Date;
  details: EmailEventPayload;
}

export const webhookPayload = (email: WebhookEmail, event: WebhookEvent): WebhookPayload => ({
  type: `email.${event.type}`,
  createdAt: event.occurredAt.toISOString(),
  data: {
    emailId: email.id,
    from: email.fromAddress,
    to: email.toAddresses,
    subject: email.subject,
    ...event.details,
  },
});
