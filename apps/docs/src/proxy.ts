const forwardedRequestHeaders = ["accept", "authorization", "content-type", "api-version", "idempotency-key"];
const droppedResponseHeaders = ["set-cookie"];

export function proxyTarget(requestUrl: string, server: string): URL | null {
  const target = new URL(requestUrl).searchParams.get("scalar_url");
  if (!target || !URL.canParse(target)) return null;
  const url = new URL(target);
  const allowed = new URL(`${server.replace(/\/$/, "")}/service/web/`);
  return url.origin === allowed.origin && url.pathname.startsWith(allowed.pathname) ? url : null;
}

export async function proxy(request: Request, server: string): Promise<Response> {
  const target = proxyTarget(request.url, server);
  if (!target) return new Response("The playground can only call the Atlair Mail API.", { status: 403 });

  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const name of droppedResponseHeaders) responseHeaders.delete(name);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
