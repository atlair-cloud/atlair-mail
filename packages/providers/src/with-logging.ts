import { ProviderError } from "./errors.ts";
import type { EmailProvider, ProviderOperation } from "./types.ts";

export interface ProviderLogger {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
}

const errorFields = (error: unknown) =>
  error instanceof ProviderError
    ? { errorCode: error.code, reason: error.reason, retryable: error.retryable }
    : { errorCode: error instanceof Error ? error.name : "UnknownError", retryable: false };

export function withLogging(provider: EmailProvider, logger: ProviderLogger): EmailProvider {
  async function run<T>(
    operation: ProviderOperation,
    context: object,
    attempt: () => Promise<T>,
    describe: (result: T) => object = () => ({}),
  ): Promise<T> {
    const started = performance.now();
    const base = { provider: provider.type, operation, ...context };
    try {
      const result = await attempt();
      logger.info(
        { ...base, outcome: "ok", durationMs: Math.round(performance.now() - started), ...describe(result) },
        "provider call succeeded",
      );
      return result;
    } catch (error) {
      logger.warn(
        { ...base, outcome: "error", durationMs: Math.round(performance.now() - started), ...errorFields(error) },
        "provider call failed",
      );
      throw error;
    }
  }

  return {
    type: provider.type,
    verifyAccount: () => run("verifyAccount", {}, () => provider.verifyAccount()),
    createDomain: (name) =>
      run("createDomain", { domain: name }, () => provider.createDomain(name), (result) => ({ status: result.status })),
    getDomain: (name) =>
      run("getDomain", { domain: name }, () => provider.getDomain(name), (result) => ({ status: result?.status ?? null })),
    send: (message) =>
      run(
        "send",
        { recipientCount: message.to.length + (message.cc?.length ?? 0) + (message.bcc?.length ?? 0) },
        () => provider.send(message),
        (result) => ({ providerMessageId: result.providerMessageId }),
      ),
  };
}
