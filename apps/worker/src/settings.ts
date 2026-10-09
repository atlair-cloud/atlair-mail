export const pollIntervalMs = 1_000;
export const leaseSeconds = 120;
export const sweepIntervalMs = 30_000;
export const sweepBatchSize = 500;
export const maxAttempts = 6;
export const retryDelaysSeconds = [30, 120, 600, 1_800, 3_600] as const;
export const shutdownGraceMs = 25_000;

export const errorCodes = {
  leaseExpired: "ATL_WORKER_LEASE_EXPIRED",
  invalidAddress: "ATL_INVALID_ADDRESS",
  workerError: "ATL_WORKER_ERROR",
  unknownOutcome: "ATL_PROVIDER_TIMEOUT",
} as const;

export const webhookConcurrency = 10;
export const webhookLeaseSeconds = 60;
export const webhookTimeoutMs = 15_000;
export const webhookRetryDelaysSeconds = [5, 300, 1_800, 7_200, 18_000, 36_000, 36_000] as const;
export const secretSweepIntervalMs = 300_000;
export const maxWebhookAttempts = webhookRetryDelaysSeconds.length + 1;

export const webhookErrorCodes = {
  endpointDisabled: "ATL_WEBHOOK_ENDPOINT_DISABLED",
  httpError: "ATL_WEBHOOK_HTTP_ERROR",
  timeout: "ATL_WEBHOOK_TIMEOUT",
  blockedAddress: "ATL_WEBHOOK_BLOCKED_ADDRESS",
  connectionFailed: "ATL_WEBHOOK_CONNECTION_FAILED",
  secretUnavailable: "ATL_WEBHOOK_SECRET_UNAVAILABLE",
} as const;

export const eventPollerConcurrency = 20;
export const eventPollLeaseSeconds = 120;
export const eventReceiveWaitSeconds = 10;
export const eventReceiveBatchSize = 10;
export const eventStatsIntervalMs = 300_000;
export const eventPollBackoffSeconds = { first: 30, max: 900 } as const;
