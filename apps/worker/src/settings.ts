export const pollIntervalMs = 1_000;
export const leaseSeconds = 120;
export const sweepIntervalMs = 30_000;
export const maxAttempts = 6;
export const retryDelaysSeconds = [30, 120, 600, 1_800, 3_600] as const;
export const shutdownGraceMs = 25_000;

export const errorCodes = {
  leaseExpired: "ATL_WORKER_LEASE_EXPIRED",
  invalidAddress: "ATL_INVALID_ADDRESS",
  workerError: "ATL_WORKER_ERROR",
  unknownOutcome: "ATL_PROVIDER_TIMEOUT",
} as const;
