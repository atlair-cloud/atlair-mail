import { GetAccountCommand } from "@aws-sdk/client-sesv2";
import { withSesClient, type SesCredentials } from "./ses-client.ts";

export function fetchSesAccount(credentials: SesCredentials) {
  return withSesClient(credentials, async (client) => {
    const account = await client.send(new GetAccountCommand({}));
    return {
      sendingEnabled: account.SendingEnabled ?? false,
      productionAccessEnabled: account.ProductionAccessEnabled ?? false,
      max24HourSend: account.SendQuota?.Max24HourSend ?? 0,
      maxSendRate: account.SendQuota?.MaxSendRate ?? 0,
    };
  });
}

export type SesAccount = Awaited<ReturnType<typeof fetchSesAccount>>;
