import createError from "@fastify/error";
import { getDomain } from "tldts";
import {
  deleteDomain,
  findDomainInOrganization,
  hasPgErrorCode,
  insertDomain,
  listDomainsByOrganization,
  pgErrorCodes,
  updateDomainVerification,
  type Database,
} from "@atlair-mail/db";
import type { Domain } from "@atlair-mail/db/schema";
import { normalizeDomainName } from "../lib/domain-names.ts";
import { createDomainIdentity, defaultDkimSigningHostedZone, getDomainIdentity } from "../lib/ses-identities.ts";
import type { SesConnectionService } from "./ses-connections.ts";

export const InvalidDomainNameError = createError(
  "ATL_INVALID_DOMAIN_NAME",
  "Not a valid domain name. Use a registrable domain such as example.com or mail.example.com",
  400,
);

export const SesNotConnectedError = createError(
  "ATL_SES_NOT_CONNECTED",
  "Connect Amazon SES with PUT /v1/ses-connection first",
  409,
);

export const DomainExistsError = createError("ATL_DOMAIN_EXISTS", "Domain %s is already added", 409);

export const DomainInUseError = createError(
  "ATL_DOMAIN_IN_USE",
  "Domain has emails and cannot be removed",
  409,
);

export function withDnsRecords(domain: Domain) {
  const zone = domain.dkimSigningHostedZone ?? defaultDkimSigningHostedZone;
  return {
    ...domain,
    records: [
      ...domain.dkimTokens.map((token) => ({
        record: "DKIM" as const,
        type: "CNAME" as const,
        name: `${token}._domainkey.${domain.name}`,
        value: `${token}.${zone}`,
        required: true,
      })),
      {
        record: "DMARC" as const,
        type: "TXT" as const,
        name: `_dmarc.${getDomain(domain.name) ?? domain.name}`,
        value: "v=DMARC1; p=none;",
        required: false,
      },
    ],
  };
}

export function createDomainService(db: Database, sesConnections: SesConnectionService) {
  async function requireCredentials(organizationId: string) {
    const credentials = await sesConnections.loadCredentials(organizationId);
    if (!credentials) throw new SesNotConnectedError();
    return credentials;
  }

  return {
    async create(organizationId: string, input: { name: string }) {
      const name = normalizeDomainName(input.name);
      if (!name) throw new InvalidDomainNameError();
      const identity = await createDomainIdentity(await requireCredentials(organizationId), name);
      const verified = identity.status === "verified";
      const domain = await insertDomain(db, {
        organizationId,
        name,
        status: identity.status,
        dkimTokens: identity.dkimTokens,
        dkimSigningHostedZone: identity.dkimSigningHostedZone,
        lastCheckedAt: new Date(),
        verifiedAt: verified ? new Date() : null,
      });
      if (!domain) throw new DomainExistsError(name);
      return withDnsRecords(domain);
    },

    async list(organizationId: string) {
      return (await listDomainsByOrganization(db, organizationId)).map(withDnsRecords);
    },

    async get(organizationId: string, id: string) {
      const domain = await findDomainInOrganization(db, { id, organizationId });
      return domain && withDnsRecords(domain);
    },

    async verify(organizationId: string, id: string) {
      const key = { id, organizationId };
      const domain = await findDomainInOrganization(db, key);
      if (!domain) return null;
      const identity = await getDomainIdentity(await requireCredentials(organizationId), domain.name);
      const updated = await updateDomainVerification(db, key, identity ?? { status: "failed" });
      return updated && withDnsRecords(updated);
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
