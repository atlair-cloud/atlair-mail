import { createSesProvider } from "./ses/ses-provider.ts";
import type { EmailProvider, ProviderConfig } from "./types.ts";
import { withLogging, type ProviderLogger } from "./with-logging.ts";
import { withRetry, type RetryOptions } from "./with-retry.ts";

export interface CreateProviderOptions {
  logger?: ProviderLogger;
  retry?: RetryOptions | false;
}

function createAdapter(config: ProviderConfig): EmailProvider {
  switch (config.type) {
    case "ses":
      return createSesProvider(config.settings, config.secrets);
  }
}

export function createProvider(config: ProviderConfig, options: CreateProviderOptions = {}): EmailProvider {
  const adapter = createAdapter(config);
  const logged = options.logger ? withLogging(adapter, options.logger) : adapter;
  return options.retry === false ? logged : withRetry(logged, options.retry);
}
