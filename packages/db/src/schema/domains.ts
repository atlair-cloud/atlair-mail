import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { DnsRecord } from "@atlair-mail/providers/types";
import { domainStatuses, type DomainStatus } from "../types.ts";
import { id, isOneOf, timestamps, timestamptz } from "./_columns.ts";
import { organizationId } from "./organizations.ts";
import { authorship } from "./_authorship.ts";

export const domains = pgTable(
  "domains",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    status: text("status").$type<DomainStatus>().notNull().default("pending"),
    dnsRecords: jsonb("dns_records").$type<DnsRecord[]>().notNull().default([]),
    lastCheckedAt: timestamptz("last_checked_at"),
    verifiedAt: timestamptz("verified_at"),
    ...authorship(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("domains_organization_id_name_unique").on(t.organizationId, t.name),
    index("domains_last_checked_at_pending_idx")
      .on(t.lastCheckedAt)
      .where(sql`${t.status} = 'pending'`),
    check("domains_name_check", sql`${t.name} = lower(${t.name})`),
    check("domains_status_check", isOneOf(t.status, domainStatuses)),
    check("domains_dns_records_check", sql`jsonb_typeof(${t.dnsRecords}) = 'array'`),
  ],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
