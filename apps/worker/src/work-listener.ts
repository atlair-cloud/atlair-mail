import { listenForWork, type WorkKind, type WorkListener } from "@atlair-mail/db";
import type { Logger } from "pino";
import { listenRetryMs } from "./settings.ts";

export interface WorkListenerOptions {
  url: string;
  logger: Logger;
  onWork: (kind: WorkKind) => void;
  onListen: () => void;
  retryMs?: number;
}

export function createWorkListener(options: WorkListenerOptions) {
  const { logger } = options;
  const retryMs = options.retryMs ?? listenRetryMs;
  let listener: WorkListener | null = null;
  let retry: NodeJS.Timeout | null = null;
  let stopped = false;

  async function connect() {
    retry = null;
    try {
      const connected = await listenForWork(options.url, {
        onWork: options.onWork,
        onListen: () => {
          logger.info("listening for new work");
          options.onListen();
        },
      });
      if (stopped) await connected.close();
      else listener = connected;
    } catch (error) {
      if (stopped) return;
      logger.warn({ err: error, retryMs }, "could not listen for new work, checking on a timer until it connects");
      retry = setTimeout(connect, retryMs);
    }
  }

  return {
    start() {
      void connect();
    },

    async stop() {
      stopped = true;
      if (retry) clearTimeout(retry);
      await listener?.close();
      logger.info("work listener stopped");
    },
  };
}
