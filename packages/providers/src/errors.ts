export class ProviderError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ProviderRejectedError extends ProviderError {
  constructor(reason: string, options?: ErrorOptions) {
    super("ATL_PROVIDER_REJECTED", 422, `The email provider rejected the request: ${reason}`, options);
  }
}

export class ProviderThrottledError extends ProviderError {
  constructor(options?: ErrorOptions) {
    super("ATL_PROVIDER_THROTTLED", 429, "The email provider is throttling requests, try again shortly", options);
  }
}

export class ProviderUnreachableError extends ProviderError {
  constructor(options?: ErrorOptions) {
    super("ATL_PROVIDER_UNREACHABLE", 502, "Could not reach the email provider", options);
  }
}
