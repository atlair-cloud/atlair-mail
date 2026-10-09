import { claimDueEmails, failExpiredLeases, type Executor } from "@atlair-mail/db";
import type { EmailProvider } from "@atlair-mail/providers";
import type { Logger } from "pino";
import { createPollLoop } from "./poll-loop.ts";
import { processEmail } from "./process-email.ts";
import { errorCodes, leaseSeconds, pollIntervalMs, sweepIntervalMs } from "./settings.ts";

export interface WorkerOptions {
  db: Executor;
  logger: Logger;
  concurrency: number;
  loadProvider: (organizationId: string) => Promise<EmailProvider | null>;
  pollIntervalMs?: number;
  sweepIntervalMs?: number;
}

export function createWorker(options: WorkerOptions) {
  const { db, logger, concurrency } = options;
  let sweeper: NodeJS.Timeout | null = null;

  const loop = createPollLoop({
    name: "email",
    logger,
    concurrency,
    pollIntervalMs: options.pollIntervalMs ?? pollIntervalMs,
    claim: (limit) => claimDueEmails(db, { limit, leaseSeconds }),
    process: (email) => processEmail(email, options),
  });

  async function sweep() {
    try {
      const expired = await failExpiredLeases(db, errorCodes.leaseExpired);
      if (expired.length > 0) logger.warn({ count: expired.length }, "failed emails whose lease expired");
    } catch (error) {
      logger.error({ err: error }, "lease sweep failed");
    }
  }

  return {
    start() {
      void sweep();
      sweeper = setInterval(sweep, options.sweepIntervalMs ?? sweepIntervalMs);
      loop.start();
      logger.info({ concurrency }, "worker started");
    },

    async stop() {
      if (sweeper) clearInterval(sweeper);
      await loop.stop();
      logger.info("worker stopped");
    },

    get inFlight() {
      return loop.inFlight;
    },
  };
}

export type Worker = ReturnType<typeof createWorker>;
