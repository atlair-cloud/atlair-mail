import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  NotFoundException,
  SESv2Client,
  SESv2ServiceException,
  TooManyRequestsException,
  type DkimAttributes,
} from "@aws-sdk/client-sesv2";
import { ProviderRejectedError, ProviderThrottledError, ProviderUnreachableError } from "../errors.ts";
import type {
  DomainVerification,
  DomainVerificationStatus,
  EmailProvider,
  SesSecrets,
  SesSettings,
} from "../types.ts";

const defaultDkimSigningHostedZone = "dkim.amazonses.com";

export function toDomainStatus(
  verificationStatus: string | undefined,
  verifiedForSending: boolean | undefined,
): DomainVerificationStatus {
  if (verificationStatus === "SUCCESS" && verifiedForSending === true) return "verified";
  if (verificationStatus === "FAILED") return "failed";
  return "pending";
}

function toProviderError(error: unknown) {
  if (error instanceof TooManyRequestsException) return new ProviderThrottledError({ cause: error });
  if (error instanceof SESv2ServiceException && error.$fault === "client") {
    return new ProviderRejectedError(error.name, { cause: error });
  }
  return new ProviderUnreachableError({ cause: error });
}

const toDomainVerification = (
  domain: string,
  dkim: DkimAttributes | undefined,
  verificationStatus: string | undefined,
  verifiedForSending: boolean | undefined,
): DomainVerification => {
  const zone = dkim?.SigningHostedZone ?? defaultDkimSigningHostedZone;
  return {
    status: toDomainStatus(verificationStatus, verifiedForSending),
    dnsRecords: (dkim?.Tokens ?? []).map((token) => ({
      record: "DKIM",
      type: "CNAME",
      name: `${token}._domainkey.${domain}`,
      value: `${token}.${zone}`,
      required: true,
    })),
  };
};

export function createSesProvider(settings: SesSettings, secrets: SesSecrets): EmailProvider {
  async function call<T>(run: (client: SESv2Client) => Promise<T>): Promise<T> {
    const client = new SESv2Client({
      region: settings.region,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: secrets.secretAccessKey },
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 5_000 },
    });
    try {
      return await run(client);
    } catch (error) {
      throw toProviderError(error);
    } finally {
      client.destroy();
    }
  }

  async function readDomain(client: SESv2Client, name: string) {
    const identity = await client.send(new GetEmailIdentityCommand({ EmailIdentity: name }));
    return toDomainVerification(
      name,
      identity.DkimAttributes,
      identity.VerificationStatus ?? identity.DkimAttributes?.Status,
      identity.VerifiedForSendingStatus,
    );
  }

  return {
    type: "ses",

    verifyAccount: () =>
      call(async (client) => {
        const account = await client.send(new GetAccountCommand({}));
        return {
          sendingEnabled: account.SendingEnabled ?? false,
          sandbox: account.ProductionAccessEnabled !== true,
          dailyQuota: account.SendQuota?.Max24HourSend ?? 0,
          maxSendRate: account.SendQuota?.MaxSendRate ?? 0,
        };
      }),

    createDomain: (name) =>
      call(async (client) => {
        try {
          const created = await client.send(
            new CreateEmailIdentityCommand({
              EmailIdentity: name,
              DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" },
            }),
          );
          return toDomainVerification(
            name,
            created.DkimAttributes,
            created.DkimAttributes?.Status,
            created.VerifiedForSendingStatus,
          );
        } catch (error) {
          if (error instanceof AlreadyExistsException) return readDomain(client, name);
          throw error;
        }
      }),

    getDomain: (name) =>
      call(async (client) => {
        try {
          return await readDomain(client, name);
        } catch (error) {
          if (error instanceof NotFoundException) return null;
          throw error;
        }
      }),
  };
}
