import createError from "@fastify/error";
import { findProviderConnectionById, type Database } from "@atlair-mail/db";
import { handleProviderMessage, type CredentialsCipher, type HandledProviderMessage } from "@atlair-mail/core";
import { ProviderEventRejectedError, type ProviderLogger } from "@atlair-mail/providers";

export const ProviderEventUnverifiedError = createError(
  "ATL_PROVIDER_EVENT_UNVERIFIED",
  "The event could not be verified",
  403,
);

export type ReceivedProviderEvent = HandledProviderMessage;

export function createProviderEventService(db: Database, cipher: CredentialsCipher, logger: ProviderLogger) {
  return {
    async receive(connectionId: string, body: unknown): Promise<ReceivedProviderEvent | null> {
      const connection = await findProviderConnectionById(db, connectionId);
      if (!connection) return null;
      try {
        return await handleProviderMessage({ db, cipher, logger }, connection, "push", body);
      } catch (error) {
        if (error instanceof ProviderEventRejectedError) {
          logger.warn({ connectionId, reason: error.reason }, "provider event rejected");
          throw new ProviderEventUnverifiedError();
        }
        throw error;
      }
    },
  };
}

export type ProviderEventService = ReturnType<typeof createProviderEventService>;
