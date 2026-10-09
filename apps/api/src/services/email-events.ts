import {
  advanceEmailStatus,
  enqueueWebhookDeliveries,
  findEmailInOrganization,
  insertEmailEvent,
  listEmailEvents,
  listOutcomeEvents,
  lockEmailForEvent,
  suppressAddresses,
  type Database,
} from "@atlair-mail/db";
import { eventSettledStatuses, statusFromEvents, suppressionsFromEvent, webhookPayload } from "@atlair-mail/core";
import { boundEventDetails, type ProviderEvent } from "@atlair-mail/providers";

export const rejectedByProvider = "ATL_PROVIDER_REJECTED: Rejected";

export type EmailEventOutcome = "applied" | "recorded" | "duplicate" | "not_found";

export interface RecordedEmailEvent {
  outcome: EmailEventOutcome;
  emailId: string | null;
  suppressed?: number;
  webhooks?: number;
}

type EmailEventRow = Awaited<ReturnType<typeof listEmailEvents>>[number];

export const toPublicEmailEvent = (event: EmailEventRow) => ({
  id: event.id,
  type: event.type,
  occurredAt: event.occurredAt,
  ...event.details,
});

export function createEmailEventService(db: Database) {
  return {
    record(organizationId: string, event: ProviderEvent): Promise<RecordedEmailEvent> {
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
    },

    async list(organizationId: string, emailId: string) {
      const email = await findEmailInOrganization(db, { id: emailId, organizationId });
      if (!email) return null;
      return listEmailEvents(db, { emailId, organizationId });
    },
  };
}

export type EmailEventService = ReturnType<typeof createEmailEventService>;
