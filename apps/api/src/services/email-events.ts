import {
  advanceEmailStatus,
  findEmailForEvent,
  findEmailInOrganization,
  insertEmailEvent,
  listEmailEvents,
  type Database,
} from "@atlair-mail/db";
import { statusForEvent, transitionSources } from "@atlair-mail/core";
import { boundEventDetails, type ProviderEvent } from "@atlair-mail/providers";

export const rejectedByProvider = "ATL_PROVIDER_REJECTED: Rejected";

export type EmailEventOutcome = "applied" | "recorded" | "duplicate" | "not_found";

export interface RecordedEmailEvent {
  outcome: EmailEventOutcome;
  emailId: string | null;
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
        const email = await findEmailForEvent(tx, {
          organizationId,
          providerMessageId: event.providerMessageId,
          emailId: event.emailId,
        });
        if (!email) return { outcome: "not_found", emailId: null };

        const stored = await insertEmailEvent(tx, {
          emailId: email.id,
          type: event.type,
          providerEventId: event.eventKey,
          occurredAt: event.occurredAt,
          payload: boundEventDetails(event.details),
        });
        if (!stored) return { outcome: "duplicate", emailId: email.id };

        const status = statusForEvent(event);
        if (!status) return { outcome: "recorded", emailId: email.id };

        const advanced = await advanceEmailStatus(tx, {
          id: email.id,
          status,
          from: transitionSources(status),
          providerMessageId: event.providerMessageId,
          occurredAt: event.occurredAt,
          lastError: status === "failed" ? rejectedByProvider : null,
        });
        return { outcome: advanced ? "applied" : "recorded", emailId: email.id };
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
