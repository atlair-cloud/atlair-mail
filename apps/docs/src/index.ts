import { sesIamPolicy } from "../../web/src/features/settings/lib/ses-policy.ts";
import guide from "./guide.md";
import { page } from "./page.ts";
import { proxy } from "./proxy.ts";
import { publicSpec, type OpenApiDocument } from "./spec.ts";

const server = "https://api.atlair.cloud/mail";
const specUrl = `${server}/docs/openapi.json`;
const title = "Atlair Mail API";

async function openApi(): Promise<Response> {
  const upstream = await fetch(specUrl, { cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit);
  if (!upstream.ok) return new Response("The API reference is unavailable right now.", { status: 502 });
  const spec = publicSpec((await upstream.json()) as OpenApiDocument, server, {
    title,
    description: guide.replace("{{ses-iam-policy}}", sesIamPolicy),
  });
  return Response.json(spec, { headers: { "cache-control": "public, max-age=300" } });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/proxy") return proxy(request, server);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
    if (pathname === "/openapi.json") return openApi();
    if (pathname === "/") {
      return new Response(page(title), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }
    return Response.redirect(new URL("/", request.url).toString(), 301);
  },
};
