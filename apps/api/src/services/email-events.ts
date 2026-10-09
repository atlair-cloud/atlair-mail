import { findEmailInOrganization, listEmailEvents, type Database } from "@atlair-mail/db";
import { recordEmailEvent } from "@atlair-mail/core";
import type { ProviderEvent } from "@atlair-mail/providers";

export { rejectedByProvider, type EmailEventOutcome, type RecordedEmailEvent } from "@atlair-mail/core";

type EmailEventRow = Awaited<ReturnType<typeof listEmailEvents>>[number];

export const toPublicEmailEvent = (event: EmailEventRow) => ({
  id: event.id,
  type: event.type,
  occurredAt: event.occurredAt,
  ...event.details,
});

export function createEmailEventService(db: Database) {
  return {
    record: (organizationId: string, event: ProviderEvent) => recordEmailEvent(db, organizationId, event),

    async list(organizationId: string, emailId: string) {
      const email = await findEmailInOrganization(db, { id: emailId, organizationId });
      if (!email) return null;
      return listEmailEvents(db, { emailId, organizationId });
    },
  };
}

export type EmailEventService = ReturnType<typeof createEmailEventService>;
