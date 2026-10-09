import createError from "@fastify/error";
import { findProviderConnectionById, type Database } from "@atlair-mail/db";
import { providerFromConnection, type CredentialsCipher } from "@atlair-mail/core";
import { ProviderEventRejectedError, readProviderWebhook, type ProviderLogger } from "@atlair-mail/providers";
import type { EmailEventOutcome, EmailEventService } from "./email-events.ts";

export const ProviderEventUnverifiedError = createError(
  "ATL_PROVIDER_EVENT_UNVERIFIED",
  "The event could not be verified",
  403,
);

export type ProviderEventOutcome = EmailEventOutcome | "confirmed" | "ignored";

export interface ReceivedProviderEvent {
  outcome: ProviderEventOutcome;
  organizationId: string;
  emailId?: string | null;
  type?: string;
}

export function createProviderEventService(
  db: Database,
  cipher: CredentialsCipher,
  emailEvents: EmailEventService,
  logger: ProviderLogger,
) {
  return {
    async receive(connectionId: string, body: unknown): Promise<ReceivedProviderEvent | null> {
      const connection = await findProviderConnectionById(db, connectionId);
      if (!connection) return null;
      const { organizationId } = connection;

      const webhook = await readProviderWebhook({ type: connection.provider, settings: connection.settings }, body).catch(
        (error: unknown) => {
          if (error instanceof ProviderEventRejectedError) {
            logger.warn({ connectionId, reason: error.reason }, "provider event rejected");
            throw new ProviderEventUnverifiedError();
          }
          throw error;
        },
      );

      switch (webhook.kind) {
        case "confirm": {
          const provider = await providerFromConnection(cipher, connection, { logger });
          await provider.confirmEvents(webhook.token);
          return { outcome: "confirmed", organizationId };
        }
        case "event": {
          const recorded = await emailEvents.record(organizationId, webhook.event);
          return { ...recorded, organizationId, type: webhook.event.type };
        }
        case "ignored":
          return { outcome: "ignored", organizationId };
      }
    },
  };
}

export type ProviderEventService = ReturnType<typeof createProviderEventService>;
