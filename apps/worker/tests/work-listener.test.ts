import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFakeProvider } from "@atlair-mail/providers/testing";
import { createWorker } from "../src/worker.ts";
import { createWorkListener } from "../src/work-listener.ts";
import { databaseUrl, silentLogger, useWorkerTestDb, waitFor } from "./helpers.ts";

describe("work listener", { skip: !databaseUrl }, () => {
  const t = useWorkerTestDb();

  it("sends a new email as soon as it is queued, without waiting for the idle timer", async () => {
    const from = await t.sender();
    const fake = createFakeProvider();
    const worker = createWorker({
      db: t.db,
      logger: silentLogger,
      concurrency: 2,
      loadProvider: async () => fake,
      idle: { minMs: 20, maxMs: 60_000 },
    });
    let listening = false;
    const listener = createWorkListener({
      url: databaseUrl!,
      logger: silentLogger,
      onWork: (kind) => kind === "email" && worker.wake(),
      onListen: () => {
        listening = true;
      },
    });
    worker.start();
    listener.start();
    await waitFor(async () => listening);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const [id] = await t.queue(from);
    await waitFor(async () => (await t.read(id!)).status === "sent", 2_000);

    await listener.stop();
    await worker.stop();
    assert.equal((await t.read(id!)).providerMessageId, "fake-1");
  });

  it("stops cleanly while the database refuses the connection", async () => {
    let listening = false;
    const listener = createWorkListener({
      url: "postgres://atlair:atlair@127.0.0.1:1/atlair_mail",
      logger: silentLogger,
      retryMs: 20,
      onWork: () => {},
      onListen: () => {
        listening = true;
      },
    });
    listener.start();

    await new Promise((resolve) => setTimeout(resolve, 100));
    await listener.stop();

    assert.equal(listening, false);
  });
});
