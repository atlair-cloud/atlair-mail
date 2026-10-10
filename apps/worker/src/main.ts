import closeWithGrace from "close-with-grace";
import pino from "pino";
import { createCredentialsCipher, loadProvider } from "@atlair-mail/core";
import { createDb } from "@atlair-mail/db";
import { loadEnv } from "./env.ts";
import { createHealthServer } from "./health.ts";
import { shutdownGraceMs } from "./settings.ts";
import { createEventPoller } from "./event-poller.ts";
import { createWebhookDispatcher } from "./webhook-dispatcher.ts";
import { createWorkListener } from "./work-listener.ts";
import { createWorker } from "./worker.ts";

const env = loadEnv();
const logger = pino({ level: env.LOG_LEVEL, redact: ["secrets", "*.secrets", "secretAccessKey", "*.secretAccessKey"] });
const cipher = createCredentialsCipher(env.CREDENTIALS_ENCRYPTION_KEYS);
const { db, close } = createDb(env.DATABASE_URL);
const providerLogger = logger.child({ component: "provider" });

const worker = createWorker({
  db,
  logger,
  concurrency: env.WORKER_CONCURRENCY,
  loadProvider: (organizationId) => loadProvider(db, cipher, organizationId, { logger: providerLogger }),
});

const webhooks = createWebhookDispatcher({ db, cipher, logger: logger.child({ component: "webhooks" }) });
const events = createEventPoller({ db, cipher, logger: logger.child({ component: "provider-events" }) });
const loops = { email: worker, webhook: webhooks, events } as const;
const listener = createWorkListener({
  url: env.DATABASE_LISTEN_URL ?? env.DATABASE_URL,
  logger: logger.child({ component: "work-listener" }),
  onWork: (kind) => loops[kind].wake(),
  onListen: () => Object.values(loops).forEach((loop) => loop.wake()),
});
const health = createHealthServer({ logger: logger.child({ component: "health" }), host: env.HOST, port: env.PORT });

closeWithGrace({ delay: shutdownGraceMs, logger }, async ({ signal, err }) => {
  if (err) logger.error({ err }, "worker crashed");
  logger.info({ signal }, "shutting down");
  await listener.stop();
  await Promise.all([worker.stop(), webhooks.stop(), events.stop(), health.stop()]);
  await close();
});

worker.start();
webhooks.start();
events.start();
listener.start();
health.start();
