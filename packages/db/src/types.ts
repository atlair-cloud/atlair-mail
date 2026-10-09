import { emailEventTypes, type EmailEventDetails, type EmailEventType } from "@atlair-mail/providers/types";

export const apiKeyPermissions = ["full_access", "sending_access"] as const;
export type ApiKeyPermission = (typeof apiKeyPermissions)[number];

export const domainStatuses = ["pending", "verified", "failed"] as const;
export type DomainStatus = (typeof domainStatuses)[number];

export const emailStatuses = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "canceled",
] as const;
export type EmailStatus = (typeof emailStatuses)[number];

export { emailEventTypes, type EmailEventDetails, type EmailEventType } from "@atlair-mail/providers/types";

export const suppressionReasons = ["hard_bounce", "complaint", "manual"] as const;
export type SuppressionReason = (typeof suppressionReasons)[number];

export const webhookDeliveryStatuses = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];

export type EmailHeaders = Record<string, string>;

export interface EmailTag {
  name: string;
  value: string;
}

export type WebhookEventType = `email.${EmailEventType}`;

export const webhookEventTypes = emailEventTypes.map((type): WebhookEventType => `email.${type}`);

export interface WebhookPayload {
  type: WebhookEventType;
  createdAt: string;
  data: EmailEventDetails & {
    emailId: string;
    from: string;
    to: string[];
    subject: string;
  };
}
