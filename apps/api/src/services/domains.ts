import createError from "@fastify/error";
import {
  creatorColumns,
  deleteDomain,
  editorColumns,
  findDomainInOrganization,
  hasPgErrorCode,
  insertDomain,
  listDomainsByOrganization,
  pgErrorCodes,
  updateDomainVerification,
  type Actor,
  type Database,
} from "@atlair-mail/db";
import type { Domain } from "@atlair-mail/db/schema";
import { normalizeDomainName } from "@atlair-mail/core";
import {
  ProviderRejectedError,
  type DomainVerification,
  type EmailProvider,
} from "@atlair-mail/providers";
import { loadAuthors, withAuthors } from "../lib/authors.ts";
import type { ProviderConnectionService } from "./provider-connections.ts";

export const InvalidDomainNameError = createError(
  "ATL_INVALID_DOMAIN_NAME",
  "Not a valid domain name. Use a registrable domain such as example.com or mail.example.com",
  400,
);

export const DomainExistsError = createError("ATL_DOMAIN_EXISTS", "Domain %s is already added", 409);

export const DomainInUseError = createError(
  "ATL_DOMAIN_IN_USE",
  "Domain has emails and cannot be removed",
  409,
);

export function withDnsRecords(domain: Domain) {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    lastCheckedAt: domain.lastCheckedAt,
    verifiedAt: domain.verifiedAt,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    records: [
      ...domain.dnsRecords.map((record) => ({ ...record, status: record.status ?? null })),
      {
        record: "DMARC" as const,
        type: "TXT" as const,
        name: `_dmarc.${domain.name}`,
        value: "v=DMARC1; p=none;",
        required: false,
        status: null,
      },
    ],
  };
}

async function withReturnPath(provider: EmailProvider, name: string, verification: DomainVerification) {
  if (verification.status !== "verified") return verification;
  if (verification.dnsRecords.some((record) => record.record === "MAIL_FROM")) return verification;
  try {
    await provider.configureReturnPath(name);
  } catch (error) {
    if (error instanceof ProviderRejectedError) return verification;
    throw error;
  }
  return (await provider.getDomain(name)) ?? verification;
}

export function createDomainService(db: Database, providerConnections: ProviderConnectionService) {
  const toPublicDomain = async (domain: Domain) => ({ ...withDnsRecords(domain), ...(await withAuthors(db, domain)) });

  return {
    async create(organizationId: string, input: { name: string }, actor: Actor) {
      const name = normalizeDomainName(input.name);
      if (!name) throw new InvalidDomainNameError();
      const provider = await providerConnections.requireProvider(organizationId);
      const verification = await withReturnPath(provider, name, await provider.createDomain(name));
      const domain = await insertDomain(db, {
        organizationId,
        name,
        status: verification.status,
        dnsRecords: verification.dnsRecords,
        lastCheckedAt: new Date(),
        verifiedAt: verification.status === "verified" ? new Date() : null,
        ...creatorColumns(actor),
        ...editorColumns(actor),
      });
      if (!domain) throw new DomainExistsError(name);
      return toPublicDomain(domain);
    },

    async list(organizationId: string) {
      const domains = await listDomainsByOrganization(db, organizationId);
      const authors = await loadAuthors(db, domains);
      return domains.map((domain) => ({ ...withDnsRecords(domain), ...authors(domain) }));
    },

    async get(organizationId: string, id: string) {
      const domain = await findDomainInOrganization(db, { id, organizationId });
      return domain && toPublicDomain(domain);
    },

    async verify(organizationId: string, id: string, actor: Actor) {
      const key = { id, organizationId };
      const domain = await findDomainInOrganization(db, key);
      if (!domain) return null;
      const provider = await providerConnections.requireProvider(organizationId);
      const found = await provider.getDomain(domain.name);
      const verification = found && (await withReturnPath(provider, domain.name, found));
      const updated = await updateDomainVerification(db, key, verification ?? { status: "failed" }, actor);
      return updated && toPublicDomain(updated);
    },

    async remove(organizationId: string, id: string) {
      try {
        return await deleteDomain(db, { id, organizationId });
      } catch (error) {
        if (hasPgErrorCode(error, pgErrorCodes.foreignKeyViolation)) throw new DomainInUseError();
        throw error;
      }
    },
  };
}

export type DomainService = ReturnType<typeof createDomainService>;
