import { emailEventTypes as providerEventTypes, type EmailEventDetails } from "@atlair-mail/providers/types";

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

export type { EmailEventDetails } from "@atlair-mail/providers/types";

export const emailEventTypes = [...providerEventTypes, "failed"] as const;
export type EmailEventType = (typeof emailEventTypes)[number];

export type EmailEventPayload = EmailEventDetails & { error?: string };

export const suppressionReasons = ["hard_bounce", "complaint", "manual"] as const;
export type SuppressionReason = (typeof suppressionReasons)[number];

export const webhookDeliveryStatuses = ["pending", "delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof webhookDeliveryStatuses)[number];

export interface Actor {
  userId: string | null;
  apiKeyId: string | null;
}

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
  data: EmailEventPayload & {
    emailId: string;
    from: string;
    to: string[];
    subject: string;
  };
}

export const permissions = [
  "organization:view",
  "organization:update",
  "organization:delete",
  "member:view",
  "member:invite",
  "member:remove",
  "member:update_role",
  "audit:view",
  "api_key:view",
  "api_key:create",
  "api_key:revoke",
  "provider:view",
  "provider:connect",
  "provider:disconnect",
  "domain:view",
  "domain:create",
  "domain:verify",
  "domain:delete",
  "email:view",
  "email:send",
  "webhook:view",
  "webhook:create",
  "webhook:update",
  "webhook:delete",
  "suppression:view",
  "suppression:create",
  "suppression:delete",
] as const;
export type Permission = (typeof permissions)[number];

export const roleNames = ["owner", "admin", "member"] as const;
export type RoleName = (typeof roleNames)[number];
