import { webhookPayload } from "@atlair-mail/core";
import {
  enqueueWebhookDeliveries,
  insertEmailEvent,
  markEmailFailed,
  type EmailEventPayload,
  type Executor,
} from "@atlair-mail/db";

export const failedEventKey = "atlair:failed";

export interface FailedEmail {
  id: string;
  webhooks: number;
}

export function failEmail(
  db: Executor,
  id: string,
  code: string,
  options: { leaseExpired?: boolean } = {},
): Promise<FailedEmail | null> {
  return db.transaction(async (tx) => {
    const email = await markEmailFailed(tx, id, code, options);
    if (!email) return null;

    const occurredAt = new Date();
    const details: EmailEventPayload = { recipients: [], error: code };
    const event = await insertEmailEvent(tx, {
      emailId: email.id,
      type: "failed",
      providerEventId: failedEventKey,
      occurredAt,
      payload: details,
    });
    if (!event) return { id: email.id, webhooks: 0 };

    const webhooks = await enqueueWebhookDeliveries(tx, {
      organizationId: email.organizationId,
      emailEventId: event.id,
      eventType: "failed",
      payload: webhookPayload(email, { type: "failed", occurredAt, details }),
    });
    return { id: email.id, webhooks: webhooks.length };
  });
}
