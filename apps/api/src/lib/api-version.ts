import type { FastifyServerOptions } from "fastify";
import type { IncomingHttpHeaders } from "node:http";

export const apiVersionHeader = "api-version";
export const defaultApiVersion = "1";

type Versions = string | readonly string[];

export function requestedApiVersion(headers: IncomingHttpHeaders): string {
  const value = headers[apiVersionHeader];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : defaultApiVersion;
}

export const isApiVersion = (value: string) => /^[1-9][0-9]{0,2}$/.test(value);

export const apiVersionConstraint = {
  name: "apiVersion",
  mustMatchWhenDerived: false,
  storage() {
    const handlers = new Map<string, number>();
    return {
      get: (version: Versions) => (typeof version === "string" ? (handlers.get(version) ?? null) : null),
      set: (versions: Versions, matching: number) => {
        for (const version of [versions].flat()) {
          handlers.set(version, (handlers.get(version) ?? 0) | matching);
        }
      },
    };
  },
  deriveConstraint: (request: { headers: IncomingHttpHeaders }) => requestedApiVersion(request.headers),
  validate(value: unknown) {
    if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && isApiVersion(v))) {
      throw new Error(`apiVersion constraint must be a non-empty list of versions like ["1"], got ${JSON.stringify(value)}`);
    }
  },
} as unknown as NonNullable<NonNullable<FastifyServerOptions["routerOptions"]>["constraints"]>[string];
