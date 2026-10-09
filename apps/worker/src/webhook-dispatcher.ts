import type { CredentialsCipher } from "@atlair-mail/core";
import {
  claimDueWebhookDeliveries,
  recordWebhookAttempt,
  type ClaimedWebhookDelivery,
  type Executor,
} from "@atlair-mail/db";
import type { Logger } from "pino";
import { Webhook } from "standardwebhooks";
import { createPollLoop } from "./poll-loop.ts";
import {
  maxWebhookAttempts,
  pollIntervalMs,
  webhookConcurrency,
  webhookErrorCodes,
  webhookLeaseSeconds,
  webhookRetryDelaysSeconds,
} from "./settings.ts";
import { createWebhookSender, type WebhookResponse, type WebhookSender } from "./webhook-sender.ts";

export interface WebhookDispatcherOptions {
  db: Executor;
  logger: Logger;
  cipher: CredentialsCipher;
  send?: WebhookSender;
  concurrency?: number;
  pollIntervalMs?: number;
  now?: () => Date;
}

export type WebhookOutcome = "delivered" | "retrying" | "failed";

export const webhookRetryDelaySeconds = (attempt: number) =>
  webhookRetryDelaysSeconds[Math.min(attempt, webhookRetryDelaysSeconds.length) - 1]!;

export async function deliverWebhook(
  delivery: ClaimedWebhookDelivery,
  options: WebhookDispatcherOptions & { send: WebhookSender },
): Promise<WebhookOutcome> {
  const { db, logger, cipher, send } = options;
  const now = options.now?.() ?? new Date();
  const { endpoint, attempt } = delivery;
  const context = { deliveryId: delivery.id, webhookEndpointId: endpoint.id, attempt };

  const response = await attemptDelivery();
  const outcome: WebhookOutcome = response.ok
    ? "delivered"
    : attempt >= maxWebhookAttempts || response.error === webhookErrorCodes.endpointDisabled
      ? "failed"
      : "retrying";

  const recorded = await recordWebhookAttempt(db, {
    id: delivery.id,
    attempt,
    status: outcome === "retrying" ? "pending" : outcome,
    nextAttemptAt:
      outcome === "retrying" ? new Date(now.getTime() + webhookRetryDelaySeconds(attempt) * 1000) : undefined,
    responseStatus: response.status,
    error: response.ok ? null : response.error,
  });
  if (!recorded) logger.warn(context, "webhook delivery was claimed again before its result was saved");
  const log = outcome === "failed" ? logger.warn.bind(logger) : logger.info.bind(logger);
  log({ ...context, outcome, status: response.status, error: response.ok ? undefined : response.error }, "webhook attempt");
  return outcome;

  async function attemptDelivery(): Promise<WebhookResponse> {
    if (endpoint.disabledAt) return { ok: false, status: null, error: webhookErrorCodes.endpointDisabled };
    let secret: string;
    try {
      secret = await cipher.decrypt(endpoint.signingSecretEncrypted, endpoint.organizationId);
    } catch (error) {
      logger.error({ ...context, err: error }, "webhook signing secret could not be decrypted");
      return { ok: false, status: null, error: webhookErrorCodes.secretUnavailable };
    }
    const body = JSON.stringify(delivery.payload);
    const signature = new Webhook(secret).sign(delivery.id, now, body);
    return send({
      url: endpoint.url,
      body,
      headers: {
        "webhook-id": delivery.id,
        "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
        "webhook-signature": signature,
      },
    });
  }
}

export function createWebhookDispatcher(options: WebhookDispatcherOptions) {
  const { db, logger } = options;
  const send = options.send ?? createWebhookSender();
  const concurrency = options.concurrency ?? webhookConcurrency;

  const loop = createPollLoop({
    name: "webhook",
    logger,
    concurrency,
    pollIntervalMs: options.pollIntervalMs ?? pollIntervalMs,
    claim: (limit) => claimDueWebhookDeliveries(db, { limit, leaseSeconds: webhookLeaseSeconds }),
    process: (delivery) => deliverWebhook(delivery, { ...options, send }),
  });

  return {
    start() {
      loop.start();
      logger.info({ concurrency }, "webhook dispatcher started");
    },

    async stop() {
      await loop.stop();
      logger.info("webhook dispatcher stopped");
    },

    get inFlight() {
      return loop.inFlight;
    },
  };
}

export type WebhookDispatcher = ReturnType<typeof createWebhookDispatcher>;
