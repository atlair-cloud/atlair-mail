import {
  AlreadyExistsException,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  LimitExceededException,
  NotFoundException,
  PutEmailIdentityMailFromAttributesCommand,
  SendEmailCommand,
  SESv2Client,
  SESv2ServiceException,
  TooManyRequestsException,
  type DkimAttributes,
  type MailFromAttributes,
} from "@aws-sdk/client-sesv2";
import libmime from "libmime";
import {
  ProviderError,
  ProviderRejectedError,
  ProviderThrottledError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../errors.ts";
import type {
  DnsRecord,
  DnsRecordStatus,
  DomainVerification,
  DomainVerificationStatus,
  EmailAddress,
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
    return new ProviderThrottledError({ cause: error, reason: error.name });
  }
  if (error instanceof SESv2ServiceException) {
    return error.$fault === "client"
      ? new ProviderRejectedError(error.name, { cause: error })
      : new ProviderUnavailableError({ cause: error, reason: error.name });
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && connectionFailureCodes.has(code)) {
    return new ProviderUnavailableError({ cause: error, reason: code.replace(/[^A-Za-z0-9]/g, "") });
  }
  return new ProviderTimeoutError({ cause: error, reason: error instanceof Error ? error.name : undefined });
}

const printableAscii = /^[\x20-\x7e]*$/;

const unsafeInAddress = /[\u0000-\u0020\u007f<>"]/;

export function formatAddress({ name, address }: EmailAddress) {
  if (unsafeInAddress.test(address)) throw new ProviderRejectedError("InvalidAddress");
  if (!name) return address;
  const displayName = printableAscii.test(name)
    ? `"${name.replace(/[\\"]/g, "\\$&")}"`
    : libmime.encodeWord(name, "Q");
  return `${displayName} <${address}>`;
}

const formatAddresses = (addresses: EmailAddress[] | undefined) => addresses?.map(formatAddress);

const toSendEmailInput = (message: EmailMessage) => ({
  FromEmailAddress: formatAddress(message.from),
  Destination: {
    ToAddresses: formatAddresses(message.to),
    CcAddresses: formatAddresses(message.cc),
    BccAddresses: formatAddresses(message.bcc),
  },
  ReplyToAddresses: formatAddresses(message.replyTo),
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

export function toRecordStatus(status: string | undefined): DnsRecordStatus {
  if (status === "SUCCESS") return "verified";
  if (status === "FAILED") return "failed";
  return "pending";
}

export const returnPathDomain = (domain: string) => `bounce.${domain}`;

const returnPathRecords = (region: string, mailFrom: MailFromAttributes | undefined): DnsRecord[] => {
  if (!mailFrom?.MailFromDomain) return [];
  const status = toRecordStatus(mailFrom.MailFromDomainStatus);
  return [
    {
      record: "MAIL_FROM",
      type: "MX",
      name: mailFrom.MailFromDomain,
      value: `feedback-smtp.${region}.amazonses.com`,
      priority: 10,
      required: false,
      status,
    },
    {
      record: "SPF",
      type: "TXT",
      name: mailFrom.MailFromDomain,
      value: "v=spf1 include:amazonses.com ~all",
      required: false,
      status,
    },
  ];
};

const toDomainVerification = (
  domain: string,
  region: string,
  dkim: DkimAttributes | undefined,
  verificationStatus: string | undefined,
  verifiedForSending: boolean | undefined,
  mailFrom?: MailFromAttributes,
): DomainVerification => {
  const zone = dkim?.SigningHostedZone ?? defaultDkimSigningHostedZone;
  return {
    status: toDomainStatus(verificationStatus, verifiedForSending),
    dnsRecords: [
      ...(dkim?.Tokens ?? []).map((token): DnsRecord => ({
        record: "DKIM",
        type: "CNAME",
        name: `${token}._domainkey.${domain}`,
        value: `${token}.${zone}`,
        required: true,
        status: toRecordStatus(dkim?.Status),
      })),
      ...returnPathRecords(region, mailFrom),
    ],
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
      settings.region,
      identity.DkimAttributes,
      identity.VerificationStatus ?? identity.DkimAttributes?.Status,
      identity.VerifiedForSendingStatus,
      identity.MailFromAttributes,
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
            settings.region,
            created.DkimAttributes,
            created.DkimAttributes?.Status,
            created.VerifiedForSendingStatus,
          );
        } catch (error) {
          if (error instanceof AlreadyExistsException) return readDomain(client, name);
          throw error;
        }
      }),

    configureReturnPath: (name) =>
      call(async (client) => {
        await client.send(
          new PutEmailIdentityMailFromAttributesCommand({
            EmailIdentity: name,
            MailFromDomain: returnPathDomain(name),
            BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
          }),
        );
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
