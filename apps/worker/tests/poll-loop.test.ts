import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPollLoop, idleDelayMs } from "../src/poll-loop.ts";
import { silentLogger, waitFor } from "./helpers.ts";

const idle = { minMs: 1_000, maxMs: 300_000 };

describe("idleDelayMs", () => {
  it("waits the longest when nothing is queued", () => {
    assert.equal(idleDelayMs(null, idle), 300_000);
  });

  it("waits until the next item is due, capped at the longest wait", () => {
    assert.equal(idleDelayMs(4_200.4, idle), 4_201);
    assert.equal(idleDelayMs(3_600_000, idle), 300_000);
  });

  it("backs off briefly when an item is due but another worker holds it", () => {
    assert.equal(idleDelayMs(0, idle), 1_000);
    assert.equal(idleDelayMs(-250, idle), 1_000);
  });
});

describe("createPollLoop", () => {
  function fakeLoop(queue: { id: string }[], nextDue: number | null = null) {
    let claims = 0;
    let dueLookups = 0;
    const processed: string[] = [];
    const loop = createPollLoop({
      name: "test",
      logger: silentLogger,
      concurrency: 2,
      idle: { minMs: 10, maxMs: 60_000 },
      claim: async (limit) => {
        claims++;
        return queue.splice(0, limit);
      },
      msUntilNextDue: async () => {
        dueLookups++;
        return nextDue;
      },
      process: async (item) => {
        processed.push(item.id);
      },
    });
    return {
      loop,
      processed,
      get claims() {
        return claims;
      },
      get dueLookups() {
        return dueLookups;
      },
    };
  }

  it("sleeps when idle instead of polling", async () => {
    const fake = fakeLoop([]);
    fake.loop.start();

    await new Promise((resolve) => setTimeout(resolve, 100));
    await fake.loop.stop();

    assert.equal(fake.claims, 1);
    assert.equal(fake.dueLookups, 1);
  });

  it("claims right away when woken", async () => {
    const queue: { id: string }[] = [];
    const fake = fakeLoop(queue);
    fake.loop.start();
    await waitFor(async () => fake.dueLookups === 1);

    queue.push({ id: "a" }, { id: "b" }, { id: "c" });
    fake.loop.wake();

    await waitFor(async () => fake.processed.length === 3, 1_000);
    await fake.loop.stop();
    assert.deepEqual(fake.processed, ["a", "b", "c"]);
  });

  it("keeps a wake that arrives while it is claiming", async () => {
    const queue: { id: string }[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let claims = 0;
    const loop = createPollLoop({
      name: "test",
      logger: silentLogger,
      concurrency: 1,
      idle: { minMs: 10, maxMs: 60_000 },
      claim: async () => {
        claims++;
        const items = queue.splice(0, 1);
        if (claims === 1) await gate;
        return items;
      },
      msUntilNextDue: async () => null,
      process: async () => {},
    });
    loop.start();
    await waitFor(async () => claims === 1);

    queue.push({ id: "a" });
    loop.wake();
    release();

    await waitFor(async () => queue.length === 0, 1_000);
    await loop.stop();
  });

  it("stops promptly while sleeping", async () => {
    const fake = fakeLoop([]);
    fake.loop.start();
    await waitFor(async () => fake.dueLookups === 1);

    const started = Date.now();
    await fake.loop.stop();

    assert.ok(Date.now() - started < 500);
  });
});
