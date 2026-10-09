const safeReason = /^[A-Za-z0-9]{1,64}$/;

export function toReason(value: unknown) {
  return typeof value === "string" && safeReason.test(value) ? value : "Unknown";
}

export interface ProviderErrorOptions extends ErrorOptions {
  reason?: unknown;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly reason: string | null;

  constructor(code: string, statusCode: number, retryable: boolean, message: string, options?: ProviderErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.reason = options?.reason === undefined ? null : toReason(options.reason);
  }

  get summary() {
    return this.reason ? `${this.code}: ${this.reason}` : this.code;
  }
}

export class ProviderRejectedError extends ProviderError {
  constructor(reason: unknown, options?: ErrorOptions) {
    super(
      "ATL_PROVIDER_REJECTED",
      422,
      false,
      `The email provider rejected the request: ${toReason(reason)}`,
      { ...options, reason },
    );
  }
}

export class ProviderThrottledError extends ProviderError {
  constructor(options?: ProviderErrorOptions) {
    super("ATL_PROVIDER_THROTTLED", 429, true, "The email provider is throttling requests, try again shortly", options);
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(options?: ProviderErrorOptions) {
    super("ATL_PROVIDER_UNAVAILABLE", 502, true, "The email provider is unavailable", options);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(options?: ProviderErrorOptions) {
    super(
      "ATL_PROVIDER_TIMEOUT",
      504,
      false,
      "The email provider did not respond in time, so the outcome is unknown",
      options,
    );
  }
}
