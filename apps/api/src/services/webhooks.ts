import { randomBytes } from "node:crypto";
import createError from "@fastify/error";
import {
  countWebhookEndpoints,
  createWebhookEndpoint,
  creatorColumns,
  deleteWebhookEndpoint,
  editorColumns,
  findWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  rotateWebhookSigningSecret,
  updateWebhookEndpoint,
  type Actor,
  type Database,
  type EmailEventType,
  type WebhookEndpointChanges,
  type WebhookEventType,
} from "@atlair-mail/db";
import type { WebhookEndpoint } from "@atlair-mail/db/schema";
import { normalizeWebhookUrl, type CredentialsCipher } from "@atlair-mail/core";
import { loadAuthors, withAuthors } from "../lib/authors.ts";

export const InvalidWebhookUrlError = createError(
  "ATL_INVALID_WEBHOOK_URL",
  "url must be a public https URL on a registered domain, without credentials or fragment",
  400,
);

export const WebhookLimitError = createError(
  "ATL_WEBHOOK_LIMIT",
  "An organization can have at most %s webhook endpoints",
  409,
);

export const maxWebhookEndpoints = 20;
export const defaultDeliveryPageSize = 50;
export const maxDeliveryPageSize = 100;
export const defaultSecretOverlapHours = 24;
export const maxSecretOverlapHours = 168;

export interface WebhookInput {
  url: string;
  eventTypes: WebhookEventType[];
}

export interface WebhookUpdate {
  url?: string;
  eventTypes?: WebhookEventType[];
  enabled?: boolean;
}

export interface SecretRotation {
  overlapHours?: number;
}

export interface DeliveryQuery {
  before?: string;
  limit?: number;
}

const toEmailEventTypes = (types: WebhookEventType[]) =>
  [...new Set(types)].map((type) => type.slice("email.".length) as EmailEventType);

const generateSigningSecret = () => `whsec_${randomBytes(32).toString("base64")}`;

const validUrl = (input: string) => {
  const url = normalizeWebhookUrl(input);
  if (!url) throw new InvalidWebhookUrlError();
  return url;
};

const toPublicEndpoint = (endpoint: WebhookEndpoint) => ({
  id: endpoint.id,
  url: endpoint.url,
  eventTypes: endpoint.eventTypes.map((type): WebhookEventType => `email.${type}`),
  enabled: endpoint.disabledAt === null,
  previousSecretExpiresAt: endpoint.previousSecretExpiresAt,
  createdAt: endpoint.createdAt,
  updatedAt: endpoint.updatedAt,
});

type DeliveryRow = Awaited<ReturnType<typeof listWebhookDeliveries>>[number];

const toPublicDelivery = (delivery: DeliveryRow) => ({
  id: delivery.id,
  eventType: delivery.payload.type,
  emailId: delivery.payload.data.emailId,
  status: delivery.status,
  attempts: delivery.attemptCount,
  nextAttemptAt: delivery.status === "pending" ? delivery.nextAttemptAt : null,
  lastResponseStatus: delivery.lastResponseStatus,
  lastError: delivery.lastError,
  deliveredAt: delivery.deliveredAt,
  createdAt: delivery.createdAt,
});

export function createWebhookService(db: Database, cipher: CredentialsCipher) {
  const withEndpointAuthors = async (endpoint: WebhookEndpoint) => ({
    ...toPublicEndpoint(endpoint),
    ...(await withAuthors(db, endpoint)),
  });

  return {
    async create(organizationId: string, input: WebhookInput, actor: Actor) {
      const url = validUrl(input.url);
      if ((await countWebhookEndpoints(db, organizationId)) >= maxWebhookEndpoints) {
        throw new WebhookLimitError(maxWebhookEndpoints);
      }
      const signingSecret = generateSigningSecret();
      const { ciphertext, keyVersion } = await cipher.encrypt(signingSecret, organizationId);
      const endpoint = await createWebhookEndpoint(db, {
        organizationId,
        url,
        eventTypes: toEmailEventTypes(input.eventTypes),
        signingSecretEncrypted: ciphertext,
        encryptionKeyVersion: keyVersion,
        ...creatorColumns(actor),
        ...editorColumns(actor),
      });
      return { ...(await withEndpointAuthors(endpoint)), signingSecret };
    },

    async list(organizationId: string) {
      const endpoints = await listWebhookEndpoints(db, organizationId);
      const authors = await loadAuthors(db, endpoints);
      return { data: endpoints.map((endpoint) => ({ ...toPublicEndpoint(endpoint), ...authors(endpoint) })) };
    },

    async get(organizationId: string, id: string) {
      const endpoint = await findWebhookEndpoint(db, organizationId, id);
      return endpoint && withEndpointAuthors(endpoint);
    },

    async update(organizationId: string, id: string, input: WebhookUpdate, actor: Actor) {
      const changes: WebhookEndpointChanges = {
        ...(input.url !== undefined && { url: validUrl(input.url) }),
        ...(input.eventTypes !== undefined && { eventTypes: toEmailEventTypes(input.eventTypes) }),
        ...(input.enabled !== undefined && { disabledAt: input.enabled ? null : new Date() }),
      };
      const endpoint =
        Object.keys(changes).length === 0
          ? await findWebhookEndpoint(db, organizationId, id)
          : await updateWebhookEndpoint(db, organizationId, id, changes, actor);
      return endpoint && withEndpointAuthors(endpoint);
    },

    async rotateSecret(organizationId: string, id: string, rotation: SecretRotation, actor: Actor) {
      const signingSecret = generateSigningSecret();
      const { ciphertext, keyVersion } = await cipher.encrypt(signingSecret, organizationId);
      const overlapSeconds = (rotation.overlapHours ?? defaultSecretOverlapHours) * 3_600;
      const endpoint = await rotateWebhookSigningSecret(
        db,
        organizationId,
        id,
        { ciphertext, keyVersion, overlapSeconds },
        actor,
      );
      return endpoint && { ...(await withEndpointAuthors(endpoint)), signingSecret };
    },

    remove: (organizationId: string, id: string) => deleteWebhookEndpoint(db, organizationId, id),

    async deliveries(organizationId: string, id: string, query: DeliveryQuery) {
      if (!(await findWebhookEndpoint(db, organizationId, id))) return null;
      const limit = query.limit ?? defaultDeliveryPageSize;
      const rows = await listWebhookDeliveries(db, {
        organizationId,
        webhookEndpointId: id,
        before: query.before,
        limit: limit + 1,
      });
      return { data: rows.slice(0, limit).map(toPublicDelivery), hasMore: rows.length > limit };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
