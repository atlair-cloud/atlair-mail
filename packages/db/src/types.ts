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

export const emailEventTypes = [
  "sent",
  "delivered",
  "delivery_delayed",
  "bounced",
  "complained",
  "rejected",
  "opened",
  "clicked",
] as const;
export type EmailEventType = (typeof emailEventTypes)[number];

export const suppressionReasons = ["hard_bounce", "complaint", "manual"] as const;
export type SuppressionReason = (typeof suppressionReasons)[number];

export const webhookDeliveryStatuses = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];

export type EmailHeaders = Record<string, string>;

export interface EmailTag {
  name: string;
  value: string;
}

export interface ProviderEventPayload {
  eventType: string;
  mail: {
    messageId: string;
    timestamp: string;
    destination: string[];
  };
  bounce?: {
    bounceType: string;
    bounceSubType: string;
    bouncedRecipients: { emailAddress: string; diagnosticCode?: string }[];
  };
  complaint?: {
    complainedRecipients: { emailAddress: string }[];
    complaintFeedbackType?: string;
  };
  delivery?: {
    recipients: string[];
    smtpResponse: string;
  };
  click?: {
    link: string;
  };
}

export interface WebhookPayload {
  type: EmailEventType;
  createdAt: string;
  data: {
    emailId: string;
    to: string[];
    subject: string;
  };
}
