import {
  handleProviderMessage,
  providerFromConnection,
  type CredentialsCipher,
  type HandledProviderMessage,
  type ProviderMessageContext,
} from "@atlair-mail/core";
import { claimDueEventPolls, finishEventPoll, type Executor } from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import {
  ProviderError,
  ProviderEventRejectedError,
  type EmailProvider,
  type EventMessage,
  type EventQueueStats,
} from "@atlair-mail/providers";
import type { Logger } from "pino";
import { createPollLoop } from "./poll-loop.ts";
import {
  errorCodes,
  eventPollBackoffSeconds,
  eventPollerConcurrency,
  eventPollLeaseSeconds,
  eventReceiveBatchSize,
  eventReceiveWaitSeconds,
  eventStatsIntervalMs,
  pollIntervalMs,
} from "./settings.ts";

export type MessageHandler = (
  context: ProviderMessageContext,
  connection: ProviderConnection,
  body: unknown,
) => Promise<HandledProviderMessage>;

export interface EventPollerOptions {
  db: Executor;
  logger: Logger;
  cipher: CredentialsCipher;
  concurrency?: number;
  pollIntervalMs?: number;
  waitSeconds?: number;
  providerFor?: (connection: ProviderConnection) => Promise<EmailProvider>;
  handleMessage?: MessageHandler;
}

export interface PollOutcome {
  received: number;
  deleted: number;
  kept: number;
  error: string | null;
  stopped: boolean;
}

export const eventPollBackoffMs = (failures: number) =>
  Math.min(eventPollBackoffSeconds.first * 2 ** Math.max(failures - 1, 0), eventPollBackoffSeconds.max) * 1_000;

const defaultHandler: MessageHandler = (context, connection, body) =>
  handleProviderMessage(context, connection, "pull", body);

const errorCodeOf = (error: unknown) => (error instanceof ProviderError ? error.summary : errorCodes.workerError);

export async function pollConnection(
  connection: ProviderConnection,
  options: EventPollerOptions,
  signal: AbortSignal,
): Promise<PollOutcome> {
  const { db, logger, cipher } = options;
  const leaseUntil = connection.eventsPollAfter!;
  const log = logger.child({ connectionId: connection.id, organizationId: connection.organizationId });
  const handle = options.handleMessage ?? defaultHandler;
  let context: ProviderMessageContext = { db, cipher, logger: log };
  const outcome: PollOutcome = { received: 0, deleted: 0, kept: 0, error: null, stopped: false };
  let stats: EventQueueStats | undefined;

  try {
    const provider = options.providerFor
      ? await options.providerFor(connection)
      : await providerFromConnection(cipher, connection, { logger: log });
    context = { ...context, provider };
    if (signal.aborted) throw signal.reason;
    const messages = await provider.receiveEventMessages({
      maxMessages: eventReceiveBatchSize,
      waitSeconds: options.waitSeconds ?? eventReceiveWaitSeconds,
      signal,
    });
    outcome.received = messages.length;

    const handled: string[] = [];
    for (const message of messages) {
      if (await processMessage(message)) handled.push(message.receipt);
      else outcome.kept++;
    }
    if (handled.length > 0) {
      const { failed } = await provider.deleteEventMessages(handled);
      outcome.deleted = handled.length - failed.length;
      if (failed.length > 0) log.warn({ count: failed.length }, "provider event messages not deleted, they will be redelivered");
    }

    const draining = connection.eventsMode !== "pull";
    const statsDue = !connection.eventsStatsAt || Date.now() - connection.eventsStatsAt.getTime() >= eventStatsIntervalMs;
    if (statsDue || (draining && messages.length === 0)) {
      stats = await provider.getEventQueueStats().catch((error: unknown) => {
        log.warn({ errorCode: errorCodeOf(error) }, "could not read event queue stats");
        return undefined;
      });
    }
    outcome.stopped = draining && messages.length === 0 && stats?.backlog === 0;
  } catch (error) {
    if (!signal.aborted) {
      outcome.error = errorCodeOf(error);
      log.warn({ errorCode: outcome.error, failures: connection.eventsFailures + 1 }, "event queue poll failed");
    }
  }

  const nextPollAt = outcome.stopped
    ? null
    : new Date(Date.now() + (outcome.error ? eventPollBackoffMs(connection.eventsFailures + 1) : 0));
  await finishEventPoll(db, {
    id: connection.id,
    leaseUntil,
    received: outcome.received,
    error: outcome.error,
    nextPollAt,
    stats,
  });
  if (outcome.received > 0 || outcome.stopped) {
    log.info(
      { received: outcome.received, deleted: outcome.deleted, kept: outcome.kept, stopped: outcome.stopped },
      "provider events pulled",
    );
  }
  return outcome;

  async function processMessage(message: EventMessage) {
    try {
      const handled = await handle(context, connection, message.body);
      log.info(
        { outcome: handled.outcome, emailId: handled.emailId, type: handled.type },
        "provider event received",
      );
      return true;
    } catch (error) {
      if (error instanceof ProviderEventRejectedError) {
        log.warn({ reason: error.reason, receiveCount: message.receiveCount }, "provider event rejected, left in the queue");
      } else {
        log.error({ errorCode: errorCodeOf(error), receiveCount: message.receiveCount }, "provider event failed, left in the queue");
      }
      return false;
    }
  }
}

export function createEventPoller(options: EventPollerOptions) {
  const { db, logger } = options;
  const concurrency = options.concurrency ?? eventPollerConcurrency;

  const loop = createPollLoop({
    name: "event poll",
    logger,
    concurrency,
    pollIntervalMs: options.pollIntervalMs ?? pollIntervalMs,
    claim: (limit) =>
      claimDueEventPolls(db, { limit, leaseUntil: new Date(Date.now() + eventPollLeaseSeconds * 1_000) }),
    process: (connection, signal) => pollConnection(connection, options, signal),
  });

  return {
    start() {
      loop.start();
      logger.info({ concurrency }, "event poller started");
    },

    async stop() {
      await loop.stop();
      logger.info("event poller stopped");
    },

    get inFlight() {
      return loop.inFlight;
    },
  };
}

export type EventPoller = ReturnType<typeof createEventPoller>;
