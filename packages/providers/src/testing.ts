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
    send: record("send", implementations.send),
  };
}
