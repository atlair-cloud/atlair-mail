import type { EmailStatus } from "@atlair-mail/db/types";
import type { EmailEventType } from "@atlair-mail/providers/types";

export const emailTransitions: Readonly<Record<EmailStatus, readonly EmailStatus[]>> = {
  queued: ["sending", "canceled", "failed"],
  sending: ["sent", "queued", "failed", "delivered", "bounced", "complained"],
  sent: ["delivered", "bounced", "complained", "failed"],
  delivered: ["bounced", "complained"],
  bounced: ["complained"],
  complained: [],
  failed: ["delivered", "bounced", "complained"],
  canceled: [],
};

export const canTransition = (from: EmailStatus, to: EmailStatus) => emailTransitions[from].includes(to);

export const isTerminal = (status: EmailStatus) => emailTransitions[status].length === 0;

export const transitionSources = (to: EmailStatus) =>
  (Object.keys(emailTransitions) as EmailStatus[]).filter((from) => canTransition(from, to));

export interface StatusEvent {
  type: EmailEventType;
}

export function statusForEvent(event: StatusEvent): EmailStatus | null {
  switch (event.type) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "bounced":
      return "bounced";
    case "complained":
      return "complained";
    case "rejected":
      return "failed";
    case "delivery_delayed":
    case "opened":
    case "clicked":
      return null;
  }
}
