import closeWithGrace from "close-with-grace";
import pino from "pino";
import { createCredentialsCipher, loadProvider } from "@atlair-mail/core";
import { createDb } from "@atlair-mail/db";
import { loadEnv } from "./env.ts";
import { shutdownGraceMs } from "./settings.ts";
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

closeWithGrace({ delay: shutdownGraceMs, logger }, async ({ signal, err }) => {
  if (err) logger.error({ err }, "worker crashed");
  logger.info({ signal }, "shutting down");
  await worker.stop();
  await close();
});

worker.start();
