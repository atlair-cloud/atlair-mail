import {
  advanceEmailStatus,
  enqueueWebhookDeliveries,
  insertEmailEvent,
  listOutcomeEvents,
  lockEmailForEvent,
  markProviderEventsConfirmed,
  suppressAddresses,
  type Executor,
} from "@atlair-mail/db";
import type { ProviderConnection } from "@atlair-mail/db/schema";
import {
  boundEventDetails,
  readProviderWebhook,
  type EmailProvider,
  type EventDeliveryMode,
  type ProviderEvent,
  type ProviderLogger,
} from "@atlair-mail/providers";
import type { CredentialsCipher } from "./credentials-cipher.ts";
import { eventSettledStatuses, statusFromEvents, suppressionsFromEvent } from "./email-status.ts";
import { providerFromConnection } from "./load-provider.ts";
import { webhookPayload } from "./webhook-payloads.ts";

export const rejectedByProvider = "ATL_PROVIDER_REJECTED: Rejected";

export type EmailEventOutcome = "applied" | "recorded" | "duplicate" | "not_found";

export interface RecordedEmailEvent {
  outcome: EmailEventOutcome;
  emailId: string | null;
  suppressed?: number;
  webhooks?: number;
}

export function recordEmailEvent(db: Executor, organizationId: string, event: ProviderEvent): Promise<RecordedEmailEvent> {
  return db.transaction(async (tx) => {
    const email = await lockEmailForEvent(tx, {
      organizationId,
      providerMessageId: event.providerMessageId,
      emailId: event.emailId,
    });
    if (!email) return { outcome: "not_found", emailId: null };

    const details = boundEventDetails(event.details);
    const stored = await insertEmailEvent(tx, {
      emailId: email.id,
      type: event.type,
      providerEventId: event.eventKey,
      occurredAt: event.occurredAt,
      payload: details,
    });
    if (!stored) return { outcome: "duplicate", emailId: email.id };

    const suppressed = await suppressAddresses(
      tx,
      organizationId,
      suppressionsFromEvent({ type: event.type, details }),
      email.id,
    );
    const webhooks = await enqueueWebhookDeliveries(tx, {
      organizationId,
      emailEventId: stored.id,
      eventType: event.type,
      payload: webhookPayload(email, { type: event.type, occurredAt: event.occurredAt, details }),
    });
    const status = statusFromEvents(await listOutcomeEvents(tx, email.id));
    const advanced =
      status &&
      (await advanceEmailStatus(tx, {
        id: email.id,
        status,
        from: eventSettledStatuses.filter((current) => current !== status),
        providerMessageId: event.providerMessageId,
        occurredAt: event.occurredAt,
        lastError: status === "failed" ? rejectedByProvider : null,
      }));
    return {
      outcome: advanced ? "applied" : "recorded",
      emailId: email.id,
      suppressed: suppressed.length,
      webhooks: webhooks.length,
    };
  });
}

export type ProviderMessageOutcome = EmailEventOutcome | "confirmed" | "ignored";

export interface HandledProviderMessage {
  outcome: ProviderMessageOutcome;
  organizationId: string;
  emailId?: string | null;
  type?: string;
}

export interface ProviderMessageContext {
  db: Executor;
  cipher: CredentialsCipher;
  logger: ProviderLogger;
  provider?: EmailProvider;
}

const otherMode = (mode: EventDeliveryMode): EventDeliveryMode => (mode === "push" ? "pull" : "push");

export async function handleProviderMessage(
  context: ProviderMessageContext,
  connection: ProviderConnection,
  channel: EventDeliveryMode,
  body: unknown,
): Promise<HandledProviderMessage> {
  const { db, cipher, logger } = context;
  const { organizationId } = connection;
  const message = await readProviderWebhook({ type: connection.provider, settings: connection.settings }, body);

  switch (message.kind) {
    case "confirm": {
      if (connection.eventsMode !== channel) return { outcome: "ignored", organizationId };
      const provider = context.provider ?? (await providerFromConnection(cipher, connection, { logger }));
      await provider.confirmEvents(message.token);
      await markProviderEventsConfirmed(db, connection.id);
      const previous = otherMode(channel);
      if (previous === "push" || connection.settings.eventQueueUrl) {
        await provider.removeEventSubscriptions(connection.id, previous).catch((error: unknown) => {
          logger.warn(
            { connectionId: connection.id, mode: previous, err: error },
            "could not remove the previous event subscription",
          );
        });
      }
      return { outcome: "confirmed", organizationId };
    }
    case "event": {
      const recorded = await recordEmailEvent(db, organizationId, message.event);
      return { ...recorded, organizationId, type: message.event.type };
    }
    case "ignored":
      return { outcome: "ignored", organizationId };
  }
}
