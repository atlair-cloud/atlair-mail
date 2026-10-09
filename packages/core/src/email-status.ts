import type { EmailStatus, SuppressionReason } from "@atlair-mail/db/types";
import type { EmailEventDetails, EmailEventType } from "@atlair-mail/providers/types";

export const emailTransitions: Readonly<Record<EmailStatus, readonly EmailStatus[]>> = {
  queued: ["sending", "canceled", "failed"],
  sending: ["sent", "queued", "failed"],
  sent: [],
  delivered: [],
  bounced: [],
  complained: [],
  failed: [],
  canceled: [],
};

export const canTransition = (from: EmailStatus, to: EmailStatus) => emailTransitions[from].includes(to);

export const eventSettledStatuses: readonly EmailStatus[] = [
  "sending",
  "sent",
  "failed",
  "delivered",
  "bounced",
  "complained",
];

export const canSettleFromEvents = (status: EmailStatus) => eventSettledStatuses.includes(status);

export type RecipientOutcome = "sent" | "delivered" | "bounced" | "complained";

export interface OutcomeEvent {
  type: EmailEventType;
  details: Pick<EmailEventDetails, "recipients" | "bounce" | "complaint">;
}

const correctionFeedback = "not-spam";

const isComplaint = (event: OutcomeEvent) =>
  event.type === "complained" && event.details.complaint?.feedbackType !== correctionFeedback;

function recipientRank(event: OutcomeEvent) {
  switch (event.type) {
    case "sent":
      return 1;
    case "delivered":
      return 3;
    case "bounced":
      return event.details.bounce?.kind === "transient" ? 2 : 4;
    case "complained":
      return isComplaint(event) ? 5 : 0;
    default:
      return 0;
  }
}

const outcomeOfRank: Record<number, RecipientOutcome> = {
  1: "sent",
  2: "bounced",
  3: "delivered",
  4: "bounced",
  5: "complained",
};

export function recipientOutcomes(events: readonly OutcomeEvent[]) {
  const ranks = new Map<string, number>();
  for (const event of events) {
    const rank = recipientRank(event);
    if (rank === 0) continue;
    for (const { address } of event.details.recipients) {
      const key = address.toLowerCase();
      ranks.set(key, Math.max(ranks.get(key) ?? 0, rank));
    }
  }
  return new Map([...ranks].map(([address, rank]) => [address, outcomeOfRank[rank]!]));
}

const emailSeverity: readonly RecipientOutcome[] = ["complained", "bounced", "delivered", "sent"];

export function statusFromEvents(events: readonly OutcomeEvent[]): EmailStatus | null {
  if (events.some((event) => event.type === "rejected")) return "failed";
  const outcomes = new Set(recipientOutcomes(events).values());
  return emailSeverity.find((outcome) => outcomes.has(outcome)) ?? null;
}

export interface SuppressionEntry {
  address: string;
  reason: SuppressionReason;
}

const maxAddressLength = 320;

const suppressible = (address: string) => {
  const normalized = address.trim().toLowerCase();
  return normalized.length <= maxAddressLength && /^[^\s@]+@[^\s@]+$/.test(normalized) ? normalized : null;
};

function reasonFor(event: OutcomeEvent): SuppressionReason | null {
  if (event.type === "bounced" && event.details.bounce?.kind === "permanent") return "hard_bounce";
  if (isComplaint(event)) return "complaint";
  return null;
}

export function suppressionsFromEvent(event: OutcomeEvent): SuppressionEntry[] {
  const reason = reasonFor(event);
  if (!reason) return [];
  const addresses = new Set(
    event.details.recipients
      .map(({ address }) => suppressible(address))
      .filter((address): address is string => address !== null),
  );
  return [...addresses].map((address) => ({ address, reason }));
}
