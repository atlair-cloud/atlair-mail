export const providerTypes = ["ses"] as const;
export type ProviderType = (typeof providerTypes)[number];

export interface SesSettings {
  region: string;
  accessKeyId: string;
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

export interface DnsRecord {
  record: "DKIM" | "SPF" | "MX" | "DMARC";
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  required: boolean;
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

export interface EmailProvider {
  readonly type: ProviderType;
  verifyAccount(): Promise<ProviderAccount>;
  createDomain(name: string): Promise<DomainVerification>;
  getDomain(name: string): Promise<DomainVerification | null>;
}
