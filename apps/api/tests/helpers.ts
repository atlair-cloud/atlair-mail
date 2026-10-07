import { after } from "node:test";
import { buildApp } from "../src/app.ts";
import type { Env } from "../src/env.ts";

export const TEST_KEY = "am_test_key";

/** Builds a ready app with quiet logs and one valid key, closed after the suite. */
export async function buildTestApp(env: Partial<Env> = {}) {
  const app = await buildApp({ env: { LOG_LEVEL: "silent", API_KEYS: TEST_KEY, ...env } });
  await app.ready();
  after(() => app.close());
  return app;
}
