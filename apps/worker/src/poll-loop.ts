import type { Logger } from "pino";

export interface IdleWait {
  minMs: number;
  maxMs: number;
}

export interface PollLoopOptions<T extends { id: string }> {
  name: string;
  logger: Logger;
  concurrency: number;
  idle: IdleWait;
  claim: (limit: number) => Promise<T[]>;
  msUntilNextDue: () => Promise<number | null>;
  process: (item: T, signal: AbortSignal) => Promise<unknown>;
}

export const idleDelayMs = (msUntilNextDue: number | null, idle: IdleWait) => {
  if (msUntilNextDue === null) return idle.maxMs;
  if (msUntilNextDue <= 0) return idle.minMs;
  return Math.min(Math.ceil(msUntilNextDue), idle.maxMs);
};

export function createPollLoop<T extends { id: string }>(options: PollLoopOptions<T>) {
  const { logger, concurrency, name, idle } = options;
  const inFlight = new Set<Promise<unknown>>();
  const stopping = new AbortController();
  let loop: Promise<void> | null = null;
  let woken = false;
  let interrupt: (() => void) | null = null;

  function wake() {
    woken = true;
    interrupt?.();
  }

  function rest(ms: number) {
    if (woken || stopping.signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        stopping.signal.removeEventListener("abort", done);
        interrupt = null;
        resolve();
      };
      const timer = setTimeout(done, ms);
      stopping.signal.addEventListener("abort", done);
      interrupt = done;
    });
  }

  async function claim() {
    const free = concurrency - inFlight.size;
    if (free <= 0) return 0;
    const claimed = await options.claim(free);
    for (const item of claimed) {
      const job = options
        .process(item, stopping.signal)
        .catch((error) => logger.error({ err: error, id: item.id }, `${name} processing crashed`))
        .finally(() => {
          inFlight.delete(job);
          wake();
        });
      inFlight.add(job);
    }
    return claimed.length;
  }

  async function idleDelay() {
    try {
      return idleDelayMs(await options.msUntilNextDue(), idle);
    } catch (error) {
      logger.error({ err: error }, `${name} next due lookup failed`);
      return idle.minMs;
    }
  }

  async function run() {
    while (!stopping.signal.aborted) {
      woken = false;
      let claimed = 0;
      let failed = false;
      try {
        claimed = await claim();
      } catch (error) {
        failed = true;
        logger.error({ err: error }, `${name} claim failed`);
      }
      if (inFlight.size >= concurrency) {
        await Promise.race(inFlight);
      } else if (failed) {
        await rest(idle.minMs);
      } else if (claimed === 0) {
        await rest(await idleDelay());
      }
    }
  }

  return {
    start() {
      loop = run();
    },

    wake,

    async stop() {
      stopping.abort();
      await loop;
      await Promise.allSettled(inFlight);
    },

    get inFlight() {
      return inFlight.size;
    },
  };
}
