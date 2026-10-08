export class ProviderError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, statusCode: number, retryable: boolean, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class ProviderRejectedError extends ProviderError {
  constructor(reason: string, options?: ErrorOptions) {
    super("ATL_PROVIDER_REJECTED", 422, false, `The email provider rejected the request: ${reason}`, options);
  }
}

export class ProviderThrottledError extends ProviderError {
  constructor(options?: ErrorOptions) {
    super("ATL_PROVIDER_THROTTLED", 429, true, "The email provider is throttling requests, try again shortly", options);
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(options?: ErrorOptions) {
    super("ATL_PROVIDER_UNAVAILABLE", 502, true, "The email provider is unavailable", options);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(options?: ErrorOptions) {
    super(
      "ATL_PROVIDER_TIMEOUT",
      504,
      false,
      "The email provider did not respond in time, so the outcome is unknown",
      options,
    );
  }
}
