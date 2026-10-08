import { setTimeout as sleep } from "node:timers/promises";
import { claimDueEmails, failExpiredLeases, type Executor } from "@atlair-mail/db";
import type { EmailProvider } from "@atlair-mail/providers";
import type { Logger } from "pino";
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
  const inFlight = new Set<Promise<unknown>>();
  const stopping = new AbortController();
  let loop: Promise<void> | null = null;
  let sweeper: NodeJS.Timeout | null = null;

  async function sweep() {
    try {
      const expired = await failExpiredLeases(db, errorCodes.leaseExpired);
      if (expired.length > 0) logger.warn({ count: expired.length }, "failed emails whose lease expired");
    } catch (error) {
      logger.error({ err: error }, "lease sweep failed");
    }
  }

  async function claim() {
    const free = concurrency - inFlight.size;
    if (free <= 0) return 0;
    const claimed = await claimDueEmails(db, { limit: free, leaseSeconds });
    for (const email of claimed) {
      const job = processEmail(email, options)
        .catch((error) => logger.error({ err: error, emailId: email.id }, "email processing crashed"))
        .finally(() => inFlight.delete(job));
      inFlight.add(job);
    }
    return claimed.length;
  }

  async function run() {
    while (!stopping.signal.aborted) {
      let claimed = 0;
      try {
        claimed = await claim();
      } catch (error) {
        logger.error({ err: error }, "claim failed");
      }
      if (inFlight.size >= concurrency) {
        await Promise.race(inFlight);
      } else if (claimed === 0) {
        await sleep(options.pollIntervalMs ?? pollIntervalMs, undefined, { signal: stopping.signal }).catch(() => {});
      }
    }
  }

  return {
    start() {
      void sweep();
      sweeper = setInterval(sweep, options.sweepIntervalMs ?? sweepIntervalMs);
      loop = run();
      logger.info({ concurrency }, "worker started");
    },

    async stop() {
      stopping.abort();
      if (sweeper) clearInterval(sweeper);
      await loop;
      await Promise.allSettled(inFlight);
      logger.info("worker stopped");
    },

    get inFlight() {
      return inFlight.size;
    },
  };
}

export type Worker = ReturnType<typeof createWorker>;
