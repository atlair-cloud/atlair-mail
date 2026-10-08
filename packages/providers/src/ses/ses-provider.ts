import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  LimitExceededException,
  NotFoundException,
  SendEmailCommand,
  SESv2Client,
  SESv2ServiceException,
  TooManyRequestsException,
  type DkimAttributes,
} from "@aws-sdk/client-sesv2";
import {
  ProviderError,
  ProviderRejectedError,
  ProviderThrottledError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors.ts";
import type {
  DomainVerification,
  DomainVerificationStatus,
  EmailMessage,
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

const connectionFailureCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

export function toProviderError(error: unknown) {
  if (error instanceof ProviderError) return error;
  if (error instanceof TooManyRequestsException || error instanceof LimitExceededException) {
    return new ProviderThrottledError({ cause: error });
  }
  if (error instanceof SESv2ServiceException) {
    return error.$fault === "client"
      ? new ProviderRejectedError(error.name, { cause: error })
      : new ProviderUnavailableError({ cause: error });
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && connectionFailureCodes.has(code)) {
    return new ProviderUnavailableError({ cause: error });
  }
  return new ProviderTimeoutError({ cause: error });
}

const toSendEmailInput = (message: EmailMessage) => ({
  FromEmailAddress: message.from,
  Destination: {
    ToAddresses: message.to,
    CcAddresses: message.cc,
    BccAddresses: message.bcc,
  },
  ReplyToAddresses: message.replyTo,
  Content: {
    Simple: {
      Subject: { Data: message.subject, Charset: "UTF-8" },
      Body: {
        Html: message.html === undefined ? undefined : { Data: message.html, Charset: "UTF-8" },
        Text: message.text === undefined ? undefined : { Data: message.text, Charset: "UTF-8" },
      },
      Headers: message.headers && Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value })),
    },
  },
  EmailTags: message.tags?.map(({ name, value }) => ({ Name: name, Value: value })),
});

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
      maxAttempts: 1,
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 10_000, throwOnRequestTimeout: true },
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

    send: (message) =>
      call(async (client) => {
        const sent = await client.send(new SendEmailCommand(toSendEmailInput(message)));
        if (!sent.MessageId) throw new ProviderTimeoutError();
        return { providerMessageId: sent.MessageId };
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
