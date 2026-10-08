import { findDomainInOrganization, findSuppressedAddresses, type Executor } from "@atlair-mail/db";
import type { Email } from "@atlair-mail/db/schema";
import type { EmailAddress, EmailProvider } from "@atlair-mail/providers";

export interface PreSendContext {
  db: Executor;
  email: Email;
  provider: EmailProvider | null;
  recipients: EmailAddress[];
}

export type PreSendCheck = (context: PreSendContext) => Promise<string | null>;

export const providerConnected: PreSendCheck = async ({ provider }) =>
  provider ? null : "ATL_PROVIDER_NOT_CONNECTED";

export const domainStillVerified: PreSendCheck = async ({ db, email }) => {
  const domain = await findDomainInOrganization(db, { id: email.domainId, organizationId: email.organizationId });
  return domain?.status === "verified" ? null : "ATL_DOMAIN_NOT_VERIFIED";
};

export const noSuppressedRecipients: PreSendCheck = async ({ db, email, recipients }) => {
  const suppressed = await findSuppressedAddresses(
    db,
    email.organizationId,
    recipients.map((recipient) => recipient.address),
  );
  return suppressed.length === 0 ? null : "ATL_RECIPIENT_SUPPRESSED";
};

export const preSendChecks: readonly PreSendCheck[] = [providerConnected, domainStillVerified, noSuppressedRecipients];

export async function runPreSendChecks(context: PreSendContext, checks = preSendChecks) {
  for (const check of checks) {
    const failure = await check(context);
    if (failure) return failure;
  }
  return null;
}
