import http from "node:http";
import https from "node:https";
import { useAgent } from "request-filtering-agent";
import { webhookErrorCodes, webhookTimeoutMs } from "./settings.ts";

export interface WebhookRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type WebhookResponse = { ok: true; status: number } | { ok: false; status: number | null; error: string };

export type WebhookSender = (request: WebhookRequest) => Promise<WebhookResponse>;

export interface WebhookSenderOptions {
  agent?: (url: string) => http.Agent;
  timeoutMs?: number;
}

const userAgent = "atlair-mail-webhooks/1";

const blockedAddress = /is not allowed\. Because/;

function classify(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return webhookErrorCodes.timeout;
  if (error instanceof Error && blockedAddress.test(error.message)) return webhookErrorCodes.blockedAddress;
  return webhookErrorCodes.connectionFailed;
}

export function createWebhookSender(options: WebhookSenderOptions = {}): WebhookSender {
  const agentFor = options.agent ?? ((url: string) => useAgent(url));
  const timeoutMs = options.timeoutMs ?? webhookTimeoutMs;

  return (request) =>
    new Promise((resolve) => {
      const url = new URL(request.url);
      const client = url.protocol === "https:" ? https : http;
      const outgoing = client.request(
        url,
        {
          method: "POST",
          agent: agentFor(request.url),
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            ...request.headers,
            "content-type": "application/json",
            "content-length": Buffer.byteLength(request.body),
            "user-agent": userAgent,
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          response.destroy();
          resolve(
            status >= 200 && status < 300
              ? { ok: true, status }
              : { ok: false, status, error: webhookErrorCodes.httpError },
          );
        },
      );
      outgoing.on("error", (error) => resolve({ ok: false, status: null, error: classify(error) }));
      outgoing.end(request.body);
    });
}
