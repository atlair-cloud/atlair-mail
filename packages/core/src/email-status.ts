import type { EmailStatus } from "@atlair-mail/db/types";

export const emailTransitions: Readonly<Record<EmailStatus, readonly EmailStatus[]>> = {
  queued: ["sending", "canceled", "failed"],
  sending: ["sent", "queued", "failed"],
  sent: ["delivered", "bounced", "complained", "failed"],
  delivered: ["bounced", "complained"],
  bounced: [],
  complained: [],
  failed: [],
  canceled: [],
};

export const canTransition = (from: EmailStatus, to: EmailStatus) => emailTransitions[from].includes(to);

export const isTerminal = (status: EmailStatus) => emailTransitions[status].length === 0;
