import createError from "@fastify/error";
import { SESv2Client, SESv2ServiceException, TooManyRequestsException } from "@aws-sdk/client-sesv2";

export interface SesCredentials {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const SesRejectedError = createError("ATL_SES_REJECTED", "AWS SES rejected the request: %s", 422);

export const SesThrottledError = createError("ATL_SES_THROTTLED", "AWS SES is throttling requests, try again shortly", 429);

export const SesUnreachableError = createError("ATL_SES_UNREACHABLE", "Could not reach SES in region %s", 502);

export function createSesClient({ region, accessKeyId, secretAccessKey }: SesCredentials) {
  return new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 2,
    requestHandler: { connectionTimeout: 3_000, requestTimeout: 5_000 },
  });
}

export function toSesError(error: unknown, region: string) {
  if (error instanceof TooManyRequestsException) return new SesThrottledError({ cause: error });
  if (error instanceof SESv2ServiceException && error.$fault === "client") return new SesRejectedError(error.name);
  return new SesUnreachableError(region, { cause: error });
}

export async function withSesClient<T>(
  credentials: SesCredentials,
  run: (client: SESv2Client) => Promise<T>,
): Promise<T> {
  const client = createSesClient(credentials);
  try {
    return await run(client);
  } catch (error) {
    throw toSesError(error, credentials.region);
  } finally {
    client.destroy();
  }
}
