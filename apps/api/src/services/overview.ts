import {
  countEmailsByDay,
  countEmailsByStatus,
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
import type { EmailService } from "./emails.ts";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const chartDays = 7;
const minimumVolumeForRates = 50;

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
  | "webhook_failing";

export interface AttentionItem {
  kind: AttentionKind;
  severity: Severity;
  title: string;
  detail: string;
  targetId: string | null;
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

export function createOverviewService(db: Database, emails: EmailService) {
  return {
    get: async (organizationId: string, now = new Date()) => {
      const since24h = new Date(now.getTime() - day);
      const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (chartDays - 1)));

      const [last24hRows, dailyRows, latestEmailAt, domainRows, provider, counts, failingWebhooks, recentEmails] =
        await Promise.all([
          countEmailsByStatus(db, organizationId, since24h),
          countEmailsByDay(db, organizationId, chartStart),
          findLatestEmailAt(db, organizationId),
          listDomainStatuses(db, organizationId),
          findProviderSummary(db, organizationId),
          countOrganizationResources(db, organizationId),
          listFailingWebhookEndpoints(db, organizationId, since24h),
          emails.list(organizationId, { limit: 10 }),
        ]);

      const daily = Array.from({ length: chartDays }, (_, index) => {
        const date = utcDay(new Date(chartStart.getTime() + index * day));
        return { day: date, counts: toCounts(dailyRows.filter((row) => row.day === date)) };
      });
      const last7d = toCounts(dailyRows);
      const last24h = toCounts(last24hRows);

      const accepted = last7d.sent + last7d.delivered + last7d.bounced + last7d.complained;
      const rates = {
        delivery: rate(last7d.delivered, accepted),
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
            }
          : { connected: false, provider: null, region: null, eventsConnected: false },
        domains: domainCounts,
        ...counts,
        firstEmailSent: latestEmailAt !== null,
      };

      const attention: AttentionItem[] = [];
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
      if (last24h.failed > 0) {
        attention.push({
          kind: "emails_failed",
          severity: "warning",
          title: `${last24h.failed} ${last24h.failed === 1 ? "email" : "emails"} failed in the last 24 hours`,
          detail: "The provider refused them. Open one to see the reason.",
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
        metrics: { last24h, last7d, daily, rates, latestEmailAt },
        attention,
        domains: domainRows,
        recentEmails,
      } as const;
    },
  };
}

export type OverviewService = ReturnType<typeof createOverviewService>;
