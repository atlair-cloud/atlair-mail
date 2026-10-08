import createError from "@fastify/error";
import { GetAccountCommand, SESv2Client, SESv2ServiceException } from "@aws-sdk/client-sesv2";

export interface SesCredentials {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const SesCredentialsRejectedError = createError(
  "ATL_SES_CREDENTIALS_REJECTED",
  "AWS rejected these SES credentials: %s",
  422,
);

export const SesUnreachableError = createError(
  "ATL_SES_UNREACHABLE",
  "Could not reach SES in region %s",
  502,
);

export async function fetchSesAccount({ region, accessKeyId, secretAccessKey }: SesCredentials) {
  const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 5_000 },
  });
  try {
    const account = await client.send(new GetAccountCommand({}));
    return {
      sendingEnabled: account.SendingEnabled ?? false,
      productionAccessEnabled: account.ProductionAccessEnabled ?? false,
      max24HourSend: account.SendQuota?.Max24HourSend ?? 0,
      maxSendRate: account.SendQuota?.MaxSendRate ?? 0,
    };
  } catch (error) {
    if (error instanceof SESv2ServiceException && error.$fault === "client") {
      throw new SesCredentialsRejectedError(error.name);
    }
    throw new SesUnreachableError(region, { cause: error });
  } finally {
    client.destroy();
  }
}

export type SesAccount = Awaited<ReturnType<typeof fetchSesAccount>>;
