import { claimDueEmails, listExpiredLeases, msUntilNextEmail, msUntilNextLeaseExpiry, type Executor } from "@atlair-mail/db";
import type { EmailProvider } from "@atlair-mail/providers";
import type { Logger } from "pino";
import { failEmail } from "./email-failures.ts";
import { createPollLoop, type IdleWait } from "./poll-loop.ts";
import { processEmail } from "./process-email.ts";
import { errorCodes, idleWaitMs, leaseSeconds, leaseSweepSlackMs, sweepBatchSize } from "./settings.ts";

export interface WorkerOptions {
  db: Executor;
  logger: Logger;
  concurrency: number;
  loadProvider: (organizationId: string) => Promise<EmailProvider | null>;
  idle?: IdleWait;
}

export function createWorker(options: WorkerOptions) {
  const { db, logger, concurrency } = options;
  const idle = options.idle ?? idleWaitMs;
  let sweepTimer: NodeJS.Timeout | null = null;
  let sweepAt = Number.POSITIVE_INFINITY;
  let stopped = false;

  const loop = createPollLoop({
    name: "email",
    logger,
    concurrency,
    idle,
    claim: async (limit) => {
      const claimed = await claimDueEmails(db, { limit, leaseSeconds });
      if (claimed.length > 0) scheduleSweep(leaseSeconds * 1_000 + leaseSweepSlackMs);
      return claimed;
    },
    msUntilNextDue: () => msUntilNextEmail(db),
    process: (email) => processEmail(email, options),
  });

  async function sweep() {
    try {
      let failed = 0;
      for (const id of await listExpiredLeases(db, sweepBatchSize)) {
        if (await failEmail(db, id, errorCodes.leaseExpired, { leaseExpired: true })) failed++;
      }
      if (failed > 0) logger.warn({ count: failed }, "failed emails whose lease expired");
    } catch (error) {
      logger.error({ err: error }, "lease sweep failed");
    }
  }

  async function msUntilNextSweep() {
    try {
      const ms = await msUntilNextLeaseExpiry(db);
      return ms === null ? idle.maxMs : Math.min(Math.max(Math.ceil(ms), 0) + leaseSweepSlackMs, idle.maxMs);
    } catch (error) {
      logger.error({ err: error }, "next lease expiry lookup failed");
      return idle.maxMs;
    }
  }

  function scheduleSweep(delayMs: number) {
    const at = Date.now() + delayMs;
    if (stopped || at >= sweepAt) return;
    if (sweepTimer) clearTimeout(sweepTimer);
    sweepAt = at;
    sweepTimer = setTimeout(runSweep, delayMs);
  }

  async function runSweep() {
    sweepTimer = null;
    sweepAt = Number.POSITIVE_INFINITY;
    await sweep();
    scheduleSweep(await msUntilNextSweep());
  }

  return {
    start() {
      void runSweep();
      loop.start();
      logger.info({ concurrency }, "worker started");
    },

    wake: loop.wake,

    async stop() {
      stopped = true;
      if (sweepTimer) clearTimeout(sweepTimer);
      await loop.stop();
      logger.info("worker stopped");
    },

    get inFlight() {
      return loop.inFlight;
    },
  };
}

export type Worker = ReturnType<typeof createWorker>;
