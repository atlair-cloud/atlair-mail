import fp from "fastify-plugin";
import cors from "@fastify/cors";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Membership, Permission } from "@atlair-mail/db";
import { apiVersionHeader } from "../lib/api-version.ts";
import {
  authBasePath,
  clientIpHeader,
  createAuth,
  panelAuthSettings,
  type Auth,
  type AuthSession,
  type AuthUser,
} from "../lib/auth.ts";

declare module "fastify" {
  interface FastifyInstance {
    auth: Auth | null;
    panelOrigins: readonly string[];
    requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    user: AuthUser | null;
    session: AuthSession | null;
    membership: Membership | null;
  }
  interface FastifyContextConfig {
    permissions?: Permission[];
  }
}

export const panelPrefix = "/service/panel";

const usesPanelCors = (url: string) => url.startsWith(`${authBasePath}/`) || url.startsWith(`${panelPrefix}/`);

function toWebHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || name === "content-length") continue;
    for (const item of [value].flat()) headers.append(name, item);
  }
  headers.set(clientIpHeader, request.ip);
  return headers;
}

export default fp(
  async function authPlugin(fastify) {
    fastify.decorateRequest("user", null);
    fastify.decorateRequest("session", null);
    fastify.decorateRequest("membership", null);

    const settings = panelAuthSettings(fastify.config);
    fastify.decorate("panelOrigins", settings?.panelOrigins ?? []);
    if (!settings) {
      fastify.decorate("auth", null);
      return;
    }

    const auth = createAuth(fastify.db, settings, fastify.log.child({ component: "auth" }));
    fastify.decorate("auth", auth);

    fastify.decorate("requireSession", async (request: FastifyRequest, reply: FastifyReply) => {
      const { headers, response } = await auth.api.getSession({
        headers: toWebHeaders(request),
        returnHeaders: true,
      });
      const cookies = headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      if (!response) throw fastify.httpErrors.unauthorized("Sign in to continue");
      request.user = response.user;
      request.session = response.session;
    });

    await fastify.register(cors, {
      delegator: (request, callback) => {
        if (!usesPanelCors(request.url ?? "")) return callback(null, { origin: false });
        callback(null, {
          origin: settings.panelOrigins,
          credentials: true,
          methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
          allowedHeaders: ["content-type", apiVersionHeader],
          exposedHeaders: [apiVersionHeader],
          maxAge: 600,
        });
      },
    });

    fastify.route({
      method: ["GET", "POST"],
      url: `${authBasePath}/*`,
      schema: { hide: true },
      async handler(request, reply) {
        const response = await auth.handler(
          new Request(new URL(request.url, settings.baseURL), {
            method: request.method,
            headers: toWebHeaders(request),
            body: request.method === "POST" && request.body !== undefined ? JSON.stringify(request.body) : undefined,
          }),
        );

        reply.status(response.status);
        response.headers.forEach((value, name) => {
          if (name !== "set-cookie") reply.header(name, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });
  },
  { name: "auth", dependencies: ["config", "db", "sensible"] },
);
