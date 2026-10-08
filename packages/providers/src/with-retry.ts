import pRetry from "p-retry";
import { ProviderError, ProviderTimeoutError } from "./errors.ts";
import type { EmailProvider, ProviderOperation } from "./types.ts";

export interface RetryEvent {
  operation: ProviderOperation;
  attempt: number;
  delayMs: number;
  error: Error;
}

export interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  maxRetryTime?: number;
  onRetry?: (event: RetryEvent) => void;
}

export const defaultRetryOptions = {
  retries: 2,
  factor: 2,
  minTimeout: 200,
  maxTimeout: 2_000,
  maxRetryTime: 5_000,
} satisfies RetryOptions;

export function isRetryable(error: unknown, operation: ProviderOperation) {
  if (!(error instanceof ProviderError)) return false;
  if (error.retryable) return true;
  return error instanceof ProviderTimeoutError && operation !== "send";
}

export function withRetry(provider: EmailProvider, options: RetryOptions = {}): EmailProvider {
  const { onRetry, ...backoff } = { ...defaultRetryOptions, ...options };

  const run = <T>(operation: ProviderOperation, attempt: () => Promise<T>) =>
    pRetry(attempt, {
      ...backoff,
      randomize: true,
      shouldRetry: ({ error }) => isRetryable(error, operation),
      onFailedAttempt: ({ error, attemptNumber, retryDelay }) => {
        if (retryDelay > 0 && isRetryable(error, operation)) {
          onRetry?.({ operation, attempt: attemptNumber, delayMs: retryDelay, error });
        }
      },
    });

  return {
    type: provider.type,
    verifyAccount: () => run("verifyAccount", () => provider.verifyAccount()),
    createDomain: (name) => run("createDomain", () => provider.createDomain(name)),
    getDomain: (name) => run("getDomain", () => provider.getDomain(name)),
    send: (message) => run("send", () => provider.send(message)),
  };
}
