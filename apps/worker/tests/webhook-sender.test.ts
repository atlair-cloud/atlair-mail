import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createWebhookSender } from "../src/webhook-sender.ts";
import { webhookErrorCodes } from "../src/settings.ts";

const request = (url: string) => ({
  url,
  body: JSON.stringify({ type: "email.delivered" }),
  headers: { "webhook-id": "msg_1", "webhook-timestamp": "1", "webhook-signature": "v1,abc" },
});

describe("webhook sender address filtering", () => {
  const send = createWebhookSender({ timeoutMs: 2_000 });

  for (const url of [
    "https://127.0.0.1:9/in",
    "https://localhost:9/in",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.1:9/in",
    "https://[::1]:9/in",
    "http://127.0.0.1:9/in",
  ]) {
    it(`refuses to connect to ${url}`, async () => {
      assert.deepEqual(await send(request(url)), {
        ok: false,
        status: null,
        error: webhookErrorCodes.blockedAddress,
      });
    });
  }
});

describe("webhook sender over HTTP", () => {
  const received: { headers: http.IncomingHttpHeaders; body: string; path?: string }[] = [];
  let base = "";
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body, path: req.url });
      if (req.url === "/ok") return res.writeHead(204).end();
      if (req.url === "/redirect") return res.writeHead(302, { location: `${base}/ok` }).end();
      if (req.url === "/slow") return;
      if (req.url === "/huge") {
        res.writeHead(200);
        const chunk = Buffer.alloc(64 * 1024, 97);
        const pump = () => res.write(chunk) && setImmediate(pump);
        return pump();
      }
      res.writeHead(500).end("boom");
    });
  });
  const send = createWebhookSender({ agent: () => new http.Agent(), timeoutMs: 300 });

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("posts the signed JSON body and accepts any 2xx", async () => {
    const result = await send(request(`${base}/ok`));

    const last = received.at(-1)!;
    assert.deepEqual(result, { ok: true, status: 204 });
    assert.equal(last.body, '{"type":"email.delivered"}');
    assert.equal(last.headers["content-type"], "application/json");
    assert.equal(last.headers["webhook-id"], "msg_1");
    assert.equal(last.headers["webhook-signature"], "v1,abc");
    assert.match(last.headers["user-agent"]!, /^atlair-mail-webhooks\//);
  });

  it("does not follow redirects", async () => {
    const before = received.length;

    const result = await send(request(`${base}/redirect`));

    assert.deepEqual(result, { ok: false, status: 302, error: webhookErrorCodes.httpError });
    assert.equal(received.length, before + 1);
  });

  it("reports error statuses, timeouts, and does not read the response body", async () => {
    assert.deepEqual(await send(request(`${base}/fail`)), {
      ok: false,
      status: 500,
      error: webhookErrorCodes.httpError,
    });
    assert.deepEqual(await send(request(`${base}/slow`)), {
      ok: false,
      status: null,
      error: webhookErrorCodes.timeout,
    });
    assert.deepEqual(await send(request(`${base}/huge`)), { ok: true, status: 200 });
  });

  it("reports a refused connection", async () => {
    const closed = http.createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const port = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));

    assert.deepEqual(await send(request(`http://127.0.0.1:${port}/in`)), {
      ok: false,
      status: null,
      error: webhookErrorCodes.connectionFailed,
    });
  });
});
