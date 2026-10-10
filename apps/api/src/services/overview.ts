import {
  countEmailsByDay,
  countEmailsByStatus,
  countFailuresByError,
  countOrganizationResources,
  emailStatuses,
  findLatestEmailAt,
  findProviderSummary,
  listDomainStatuses,
  listFailingWebhookEndpoints,
  type Database,
  type EmailStatus,
  type EmailStatusCount,
} from "@atlair-mail/db";
import type { ProviderAccount } from "@atlair-mail/providers";
import type { EmailService } from "./emails.ts";
import type { ProviderConnectionService } from "./provider-connections.ts";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const chartDays = 7;
export const minimumVolumeForRates = 50;
const quotaWarning = 0.8;

export const rateLimits = {
  bounce: { warning: 0.02, critical: 0.05 },
  complaint: { warning: 0.0005, critical: 0.001 },
};

export type StatusCounts = Record<EmailStatus, number> & { total: number };

export type Severity = "warning" | "critical";

export type AttentionKind =
  | "domain_failed"
  | "domain_pending"
  | "events_not_connected"
  | "events_error"
  | "bounce_rate"
  | "complaint_rate"
  | "emails_failed"
  | "emails_sandbox"
  | "emails_suppressed"
  | "sending_paused"
  | "quota_near"
  | "webhook_failing";

export interface AttentionItem {
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  targetId: string | null;
}

interface FailureGroup {
  error: string | null;
  count: number;
  latestEmailId: string;
}

const emailsWord = (count: number) => `${count} ${count === 1 ? "email" : "emails"}`;

export function failureAttention(group: FailureGroup, account: ProviderAccount | null): AttentionItem {
  const [code = "", reason = ""] = (group.error ?? "").split(":").map((part) => part.trim());
  const emails = emailsWord(group.count);
  const item = (kind: AttentionKind, title: string, detail: string): AttentionItem => ({
    kind,
    severity: "warning",
    title,
    detail,
    targetId: group.latestEmailId,
  });
  switch (code) {
    case "ATL_PROVIDER_REJECTED":
      if (account?.sandbox && reason === "MessageRejected") {
        return item(
          "emails_sandbox",
          `${emails} refused: your Amazon SES account is in the sandbox`,
          "In the sandbox, SES only sends to addresses verified in your AWS account. Request production access, or verify the recipient in SES to test.",
        );
      }
      return item(
        "emails_failed",
        `${emails} refused by Amazon SES`,
        `SES rejected them${reason ? ` (${reason})` : ""}. Check the sender address and the content, then send again.`,
      );
    case "ATL_RECIPIENT_SUPPRESSED":
      return item(
        "emails_suppressed",
        `${emails} skipped: every recipient is suppressed`,
        "They bounced or marked an earlier email as spam, so nothing was sent. Remove an address from suppressions only if you're sure it works now.",
      );
    case "ATL_DOMAIN_NOT_VERIFIED":
      return item("emails_failed", `${emails} failed: the sending domain isn't verified`, "Verify the domain in the from address, then send again.");
    case "ATL_PROVIDER_NOT_CONNECTED":
      return item("emails_failed", `${emails} failed: no provider was connected`, "Connect Amazon SES, then send again.");
    case "ATL_PROVIDER_THROTTLED":
      return item(
        "emails_failed",
        `${emails} failed: over the SES sending rate`,
        `Every retry hit the limit${account ? ` of ${account.maxSendRate} per second` : ""}. Send more slowly, or ask AWS to raise it.`,
      );
    case "ATL_INVALID_ADDRESS":
      return item("emails_failed", `${emails} failed: an address isn't valid`, "Fix the address and send again.");
    default:
      return item(
        "emails_failed",
        `${emails} failed`,
        group.error ? `The last attempt ended with ${group.error}. Open one to see what happened.` : "Open one to see what happened.",
      );
  }
}

function toCounts(rows: EmailStatusCount[]): StatusCounts {
  const counts = Object.fromEntries(emailStatuses.map((status) => [status, 0])) as StatusCounts;
  counts.total = 0;
  for (const row of rows) {
    counts[row.status] += row.count;
    counts.total += row.count;
  }
  return counts;
}

function rate(part: number, whole: number) {
  return whole === 0 ? null : part / whole;
}

function percent(value: number) {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function createOverviewService(db: Database, emails: EmailService, providerConnections: ProviderConnectionService) {
  return {
    get: async (organizationId: string, now = new Date()) => {
      const since24h = new Date(now.getTime() - day);
      const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (chartDays - 1)));

      const [last24hRows, dailyRows, latestEmailAt, domainRows, provider, counts, failingWebhooks, recentEmails, failures, account] =
        await Promise.all([
          countEmailsByStatus(db, organizationId, since24h),
          countEmailsByDay(db, organizationId, chartStart),
          findLatestEmailAt(db, organizationId),
          listDomainStatuses(db, organizationId),
          findProviderSummary(db, organizationId),
          countOrganizationResources(db, organizationId),
          listFailingWebhookEndpoints(db, organizationId, since24h),
          emails.list(organizationId, { limit: 10 }).then((page) => page.data),
          countFailuresByError(db, organizationId, since24h),
          providerConnections.account(organizationId),
        ]);

      const daily = Array.from({ length: chartDays }, (_, index) => {
        const date = utcDay(new Date(chartStart.getTime() + index * day));
        return { day: date, counts: toCounts(dailyRows.filter((row) => row.day === date)) };
      });
      const last7d = toCounts(dailyRows);
      const last24h = toCounts(last24hRows);

      const accepted = last7d.sent + last7d.delivered + last7d.bounced + last7d.complained;
      const finished = last7d.delivered + last7d.bounced + last7d.complained + last7d.failed;
      const rates = {
        delivery: rate(last7d.delivered, finished),
        bounce: rate(last7d.bounced, accepted),
        complaint: rate(last7d.complained, accepted),
      };

      const domainCounts = {
        total: domainRows.length,
        verified: domainRows.filter((domain) => domain.status === "verified").length,
        pending: domainRows.filter((domain) => domain.status === "pending").length,
        failed: domainRows.filter((domain) => domain.status === "failed").length,
      };

      const setup = {
        provider: provider
          ? {
              connected: true,
              provider: provider.provider,
              region: provider.settings.region,
              eventsConnected: provider.eventsConfirmedAt !== null,
              account,
            }
          : { connected: false, provider: null, region: null, eventsConnected: false, account: null },
        domains: domainCounts,
        ...counts,
        firstEmailSent: latestEmailAt !== null,
      };

      const attention: AttentionItem[] = [];
      if (provider && account && !account.sendingEnabled) {
        attention.push({
          kind: "sending_paused",
          severity: "critical",
          title: "Amazon SES has paused sending for this account",
          detail: "Every email will fail until AWS turns sending back on. Check the account status in the SES console.",
          targetId: null,
        });
      }
      for (const domain of domainRows) {
        if (domain.status === "failed") {
          attention.push({
            kind: "domain_failed",
            severity: "critical",
            title: `${domain.name} failed verification`,
            detail: "Emails from this domain can't be sent. Check its DNS records, then verify again.",
            targetId: domain.id,
          });
        }
      }
      if (setup.firstEmailSent) {
        for (const domain of domainRows) {
          if (domain.status === "pending") {
            attention.push({
              kind: "domain_pending",
              severity: "warning",
              title: `${domain.name} is waiting for DNS`,
              detail: "Add its DNS records at your DNS provider; it's checked again every few minutes.",
              targetId: domain.id,
            });
          }
        }
      }
      if (provider && provider.eventsConfirmedAt === null && setup.firstEmailSent) {
        attention.push({
          kind: "events_not_connected",
          severity: "warning",
          title: "Delivery events aren't connected",
          detail: "Emails stay at sent: deliveries, bounces and complaints won't show up, and bounced addresses won't be suppressed.",
          targetId: null,
        });
      } else if (provider?.eventsLastError) {
        attention.push({
          kind: "events_error",
          severity: "warning",
          title: "Delivery events are failing",
          detail: provider.eventsLastError,
          targetId: null,
        });
      }
      if (accepted >= minimumVolumeForRates && rates.bounce !== null && rates.bounce >= rateLimits.bounce.warning) {
        const critical = rates.bounce >= rateLimits.bounce.critical;
        attention.push({
          kind: "bounce_rate",
          severity: critical ? "critical" : "warning",
          title: `Bounce rate is ${percent(rates.bounce)} this week`,
          detail: critical
            ? "Amazon SES reviews accounts at 5% and can pause sending. Clean your recipient lists now."
            : "Amazon SES reviews accounts at 5%. Check where bounced addresses come from.",
          targetId: null,
        });
      }
      if (accepted >= minimumVolumeForRates && rates.complaint !== null && rates.complaint >= rateLimits.complaint.warning) {
        const critical = rates.complaint >= rateLimits.complaint.critical;
        attention.push({
          kind: "complaint_rate",
          severity: critical ? "critical" : "warning",
          title: `Complaint rate is ${percent(rates.complaint)} this week`,
          detail: critical
            ? "Amazon SES reviews accounts at 0.1% and can pause sending. Only email people who asked for it."
            : "Amazon SES reviews accounts at 0.1%. Make unsubscribing easy.",
          targetId: null,
        });
      }
      for (const group of failures) attention.push(failureAttention(group, account));
      if (account && account.dailyQuota > 0 && account.sentLast24h >= account.dailyQuota * quotaWarning) {
        attention.push({
          kind: "quota_near",
          severity: account.sentLast24h >= account.dailyQuota ? "critical" : "warning",
          title: `${account.sentLast24h.toLocaleString("en")} of ${account.dailyQuota.toLocaleString("en")} daily SES emails used`,
          detail: "Amazon SES refuses emails over the 24-hour quota. Ask AWS for a higher limit before you reach it.",
          targetId: null,
        });
      }
      for (const endpoint of failingWebhooks) {
        attention.push({
          kind: "webhook_failing",
          severity: "warning",
          title: `Webhook ${endpoint.url} is failing`,
          detail: `${endpoint.failures} ${endpoint.failures === 1 ? "delivery" : "deliveries"} failed or retrying in the last 24 hours.`,
          targetId: endpoint.id,
        });
      }
      attention.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));

      const ready = setup.provider.connected && domainCounts.verified > 0 && setup.firstEmailSent;
      const health = !ready
        ? "setup"
        : attention.some((item) => item.severity === "critical")
          ? "critical"
          : attention.length > 0
            ? "warning"
            : "ok";

      return {
        generatedAt: now,
        health,
        setup,
        metrics: {
          last24h,
          last7d,
          daily,
          rates,
          volume: { accepted, finished, minimumForRates: minimumVolumeForRates },
          latestEmailAt,
        },
        attention,
        domains: domainRows,
        recentEmails,
      } as const;
    },
  };
}

export type OverviewService = ReturnType<typeof createOverviewService>;
