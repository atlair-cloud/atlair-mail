import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  type DkimAttributes,
  type SESv2Client,
} from "@aws-sdk/client-sesv2";
import type { DomainStatus } from "@atlair-mail/db";
import { withSesClient, type SesCredentials } from "./ses-client.ts";

export const defaultDkimSigningHostedZone = "dkim.amazonses.com";

export interface DomainIdentity {
  status: DomainStatus;
  dkimTokens: string[];
  dkimSigningHostedZone: string;
}

export function toDomainStatus(verificationStatus: string | undefined, verifiedForSending: boolean | undefined): DomainStatus {
  if (verificationStatus === "SUCCESS" && verifiedForSending === true) return "verified";
  if (verificationStatus === "FAILED") return "failed";
  return "pending";
}

const toDomainIdentity = (
  dkim: DkimAttributes | undefined,
  verificationStatus: string | undefined,
  verifiedForSending: boolean | undefined,
): DomainIdentity => ({
  status: toDomainStatus(verificationStatus, verifiedForSending),
  dkimTokens: dkim?.Tokens ?? [],
  dkimSigningHostedZone: dkim?.SigningHostedZone ?? defaultDkimSigningHostedZone,
});

async function readIdentity(client: SESv2Client, domain: string) {
  const identity = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
  return toDomainIdentity(
    identity.DkimAttributes,
    identity.VerificationStatus ?? identity.DkimAttributes?.Status,
    identity.VerifiedForSendingStatus,
  );
}

export function createDomainIdentity(credentials: SesCredentials, domain: string) {
  return withSesClient(credentials, async (client) => {
    try {
      const created = await client.send(
        new CreateEmailIdentityCommand({
          EmailIdentity: domain,
          DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
        }),
      );
      return toDomainIdentity(created.DkimAttributes, created.DkimAttributes?.Status, created.VerifiedForSendingStatus);
    } catch (error) {
      if (error instanceof AlreadyExistsException) return readIdentity(client, domain);
      throw error;
    }
  });
}

export function getDomainIdentity(credentials: SesCredentials, domain: string) {
  return withSesClient(credentials, async (client) => {
    try {
      return await readIdentity(client, domain);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  });
}
