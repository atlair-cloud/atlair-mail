import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "pino";

export interface PollLoopOptions<T extends { id: string }> {
  name: string;
  logger: Logger;
  concurrency: number;
  pollIntervalMs: number;
  claim: (limit: number) => Promise<T[]>;
  process: (item: T) => Promise<unknown>;
}

export function createPollLoop<T extends { id: string }>(options: PollLoopOptions<T>) {
  const { logger, concurrency, name } = options;
  const inFlight = new Set<Promise<unknown>>();
  const stopping = new AbortController();
  let loop: Promise<void> | null = null;

  async function claim() {
    const free = concurrency - inFlight.size;
    if (free <= 0) return 0;
    const claimed = await options.claim(free);
    for (const item of claimed) {
      const job = options
        .process(item)
        .catch((error) => logger.error({ err: error, id: item.id }, `${name} processing crashed`))
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
        logger.error({ err: error }, `${name} claim failed`);
      }
      if (inFlight.size >= concurrency) {
        await Promise.race(inFlight);
      } else if (claimed === 0) {
        await sleep(options.pollIntervalMs, undefined, { signal: stopping.signal }).catch(() => {});
      }
    }
  }

  return {
    start() {
      loop = run();
    },

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
