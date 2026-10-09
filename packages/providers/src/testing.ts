import { createSign, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { snsValidator } from "./ses/ses-webhook.ts";
import type {
  DomainVerification,
  EmailMessage,
  EmailProvider,
  ProviderAccount,
  ProviderOperation,
  SendResult,
} from "./types.ts";

export interface FakeProviderCall {
  operation: ProviderOperation;
  args: unknown[];
}

export type FakeProvider = EmailProvider & { calls: FakeProviderCall[] };

export function createFakeProvider(overrides: Partial<Omit<EmailProvider, "type">> = {}): FakeProvider {
  const calls: FakeProviderCall[] = [];
  let sent = 0;

  const pendingDomain = async (): Promise<DomainVerification> => ({ status: "pending", dnsRecords: [] });

  const implementations: Omit<EmailProvider, "type"> = {
    verifyAccount: async (): Promise<ProviderAccount> => ({
      sendingEnabled: true,
      sandbox: false,
      dailyQuota: 50_000,
      maxSendRate: 14,
    }),
    createDomain: pendingDomain,
    getDomain: pendingDomain,
    configureReturnPath: async () => {},
    configureEvents: async () => ({
      region: "us-east-1",
      accessKeyId: "AKIAFAKE",
      eventTopicArn: "arn:aws:sns:us-east-1:123456789012:atlair-mail-events",
      configurationSetName: "atlair-mail",
    }),
    confirmEvents: async () => {},
    send: async (_message: EmailMessage): Promise<SendResult> => ({ providerMessageId: `fake-${++sent}` }),
    ...overrides,
  };

  const record =
    <A extends unknown[], R>(operation: ProviderOperation, run: (...args: A) => Promise<R>) =>
    (...args: A) => {
      calls.push({ operation, args });
      return run(...args);
    };

  return {
    type: "ses",
    calls,
    verifyAccount: record("verifyAccount", implementations.verifyAccount),
    createDomain: record("createDomain", implementations.createDomain),
    getDomain: record("getDomain", implementations.getDomain),
    configureReturnPath: record("configureReturnPath", implementations.configureReturnPath),
    configureEvents: record("configureEvents", implementations.configureEvents),
    confirmEvents: record("confirmEvents", implementations.confirmEvents),
    send: record("send", implementations.send),
  };
}

const snsSignedFields: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"],
};

export function createSnsTestSigner(region = "ap-south-1") {
  const certUrl = `https://sns.${region}.amazonaws.com/SimpleNotificationService-${randomBytes(16).toString("hex")}.pem`;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  (snsValidator as unknown as { certCache: Map<string, string> }).certCache.set(
    certUrl,
    publicKey.export({ type: "spki", format: "pem" }).toString(),
  );

  return function sign(fields: Record<string, string> & { Type: string; TopicArn: string }) {
    const message: Record<string, string> = {
      MessageId: randomUUID(),
      Timestamp: new Date().toISOString(),
      SignatureVersion: "2",
      SigningCertURL: certUrl,
      ...fields,
    };
    const signer = createSign("sha256WithRSAEncryption");
    for (const key of snsSignedFields[message.Type!] ?? []) {
      if (key in message) signer.write(`${key}\n${message[key]}\n`);
    }
    signer.end();
    return { ...message, Signature: signer.sign(privateKey, "base64") };
  };
}
