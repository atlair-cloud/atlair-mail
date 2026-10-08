import { createSesProvider } from "./ses/ses-provider.ts";
import type { EmailProvider, ProviderConfig } from "./types.ts";

export function createProvider(config: ProviderConfig): EmailProvider {
  switch (config.type) {
    case "ses":
      return createSesProvider(config.settings, config.secrets);
  }
}
