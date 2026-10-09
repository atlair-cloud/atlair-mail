import { readSesWebhook } from "./ses/ses-webhook.ts";
import type { ProviderEvent, ProviderSettings, ProviderType } from "./types.ts";

export type ProviderWebhook =
  | { kind: "confirm"; token: string }
  | { kind: "event"; event: ProviderEvent }
  | { kind: "ignored" };

export class ProviderEventRejectedError extends Error {
  readonly reason: string;

  constructor(reason: string, options?: ErrorOptions) {
    super(`Provider event rejected: ${reason}`, options);
    this.name = "ProviderEventRejectedError";
    this.reason = reason;
  }
}

export interface WebhookSource {
  type: ProviderType;
  settings: ProviderSettings;
}

export function readProviderWebhook(source: WebhookSource, body: unknown): Promise<ProviderWebhook> {
  switch (source.type) {
    case "ses":
      return readSesWebhook(source.settings, body);
  }
}
