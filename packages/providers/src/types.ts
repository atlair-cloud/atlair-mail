export const providerTypes = ["ses"] as const;
export type ProviderType = (typeof providerTypes)[number];

export interface SesSettings {
  region: string;
  accessKeyId: string;
  eventTopicArn?: string;
  configurationSetName?: string;
  eventQueueUrl?: string;
  eventDeadLetterQueueUrl?: string;
}

export interface SesSecrets {
  secretAccessKey: string;
}

interface ProviderConfigsByType {
  ses: { settings: SesSettings; secrets: SesSecrets };
}

export type ProviderConfig = {
  [T in ProviderType]: { type: T } & ProviderConfigsByType[T];
}[ProviderType];

export type ProviderSettings = ProviderConfig["settings"];
export type ProviderSecrets = ProviderConfig["secrets"];

export type DomainVerificationStatus = "pending" | "verified" | "failed";

export type DnsRecordStatus = "pending" | "verified" | "failed";

export interface DnsRecord {
  record: "DKIM" | "MAIL_FROM" | "SPF" | "DMARC";
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  priority?: number;
  required: boolean;
  status: DnsRecordStatus | null;
}

export interface DomainVerification {
  status: DomainVerificationStatus;
  dnsRecords: DnsRecord[];
}

export interface ProviderAccount {
  sendingEnabled: boolean;
  sandbox: boolean;
  dailyQuota: number;
  maxSendRate: number;
}

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailMessage {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: EmailTag[];
}

export interface SendResult {
  providerMessageId: string;
}

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

export const bounceKinds = ["permanent", "transient", "undetermined"] as const;
export type BounceKind = (typeof bounceKinds)[number];

export interface EventRecipient {
  address: string;
  diagnosticCode?: string;
}

export interface EmailEventDetails {
  recipients: EventRecipient[];
  bounce?: { kind: BounceKind; subType: string };
  complaint?: { feedbackType?: string };
  smtpResponse?: string;
  link?: string;
}

export interface ProviderEvent {
  eventKey: string;
  providerMessageId: string;
  emailId?: string;
  type: EmailEventType;
  occurredAt: Date;
  details: EmailEventDetails;
}

export const eventDeliveryModes = ["push", "pull"] as const;
export type EventDeliveryMode = (typeof eventDeliveryModes)[number];

export type EventDelivery = { mode: "push"; endpointUrl: string } | { mode: "pull" };

export interface EventMessage {
  id: string;
  receipt: string;
  body: unknown;
  receiveCount: number;
}

export interface ReceiveEventsOptions {
  maxMessages: number;
  waitSeconds: number;
  signal?: AbortSignal;
}

export interface EventsConfiguration {
  settings: ProviderSettings;
  subscriptionActive: boolean;
}

export interface EventQueueStats {
  backlog: number;
  deadLetters: number;
}

export interface EmailProvider {
  readonly type: ProviderType;
  verifyAccount(): Promise<ProviderAccount>;
  createDomain(name: string): Promise<DomainVerification>;
  getDomain(name: string): Promise<DomainVerification | null>;
  configureReturnPath(name: string): Promise<void>;
  configureEvents(connectionId: string, delivery: EventDelivery): Promise<EventsConfiguration>;
  confirmEvents(token: string): Promise<void>;
  removeEventSubscriptions(connectionId: string, mode: EventDeliveryMode): Promise<void>;
  receiveEventMessages(options: ReceiveEventsOptions): Promise<EventMessage[]>;
  deleteEventMessages(receipts: string[]): Promise<{ failed: string[] }>;
  getEventQueueStats(): Promise<EventQueueStats>;
  redriveEventMessages(): Promise<void>;
  send(message: EmailMessage): Promise<SendResult>;
}

export type ProviderOperation = Exclude<keyof EmailProvider, "type">;
