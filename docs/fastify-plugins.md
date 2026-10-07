# Fastify plugins

The plugins `apps/api` uses, picked from the [Fastify ecosystem](https://fastify.dev/ecosystem/).
For each one: what it's for, where it's set up, and how to use it when writing code.

| Package | Set up in | You'll touch it when |
| --- | --- | --- |
| [`@fastify/autoload`](#fastifyautoload) | `src/app.ts` | Adding any route or shared plugin |
| [`@fastify/type-provider-typebox`](#fastifytype-provider-typebox--typebox) + `typebox` | Each route file | Writing route schemas |
| [`env-schema`](#env-schema) | `src/env.ts`, `src/config.ts` | Adding an environment variable |
| [`@fastify/bearer-auth`](#fastifybearer-auth) | `src/routes/v1/autohooks.ts` | Reading the caller's API key |
| [`@fastify/rate-limit`](#fastifyrate-limit) | `src/routes/v1/autohooks.ts` | Giving a route its own limit |
| [`@fastify/sensible`](#fastifysensible) | `src/plugins/sensible.ts` | Returning an HTTP error |
| [`@fastify/under-pressure`](#fastifyunder-pressure) | `src/plugins/under-pressure.ts` | Adding a dependency check to `/health` |
| [`@fastify/swagger`](#fastifyswagger--scalarfastify-api-reference) + `@scalar/fastify-api-reference` | `src/plugins/swagger.ts` | Documenting a route |
| [`@fastify/helmet`](#fastifyhelmet) | `src/app.ts` | Rarely |

## Registration order

`buildApp()` in `src/app.ts` registers things in this order, and the order matters:

1. `config.ts`: registered explicitly, so everything after it can read `fastify.config`.
2. `helmet`.
3. `autoload` of `src/plugins/`: loads app-wide plugins alphabetically. `swagger` must come before any route, and it does, because routes load in step 4.
4. `autoload` of `src/routes/`: loads routes, with folder-scoped `autohooks.ts`.

---

## `@fastify/autoload`

Loads every file in a folder as a plugin, so `app.ts` never changes when you add a route.

**How it maps files to URLs**

```
src/routes/
├── v1/
│   ├── autohooks.ts            hooks for everything under /v1 (auth, rate limit)
│   └── api-keys/
│       └── index.ts            fastify.get("/current")  →  GET /v1/api-keys/current
```

- **Folders become URL prefixes.** File names don't, so `v1/emails/index.ts` defining `"/"` serves `/v1/emails`.
- **`autohooks.ts` applies to its folder and every folder below it** (`cascadeHooks: true`). Hooks you would otherwise add with `addHook` or nested `register` calls go here.
- **Files in `src/plugins/` must be wrapped in `fastify-plugin`.** Otherwise their decorators stay hidden inside their own scope and routes can't see them.

**Add a route:** create `src/routes/v1/<resource>/index.ts`:

```ts
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const emailRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post("/", { schema: { /* ... */ } }, async (request) => { /* ... */ });
};

export default emailRoutes;
```

**Add a public route group** (no API key), such as SES webhooks: create `src/routes/webhooks/ses/index.ts`. It sits outside `v1/`, so the v1 `autohooks.ts` doesn't apply.

**Add an app-wide plugin:** create `src/plugins/<name>.ts` that default-exports `fp(async (fastify) => { ... }, { name: "<name>" })`. If it reads another decorator, declare that with `dependencies: ["config"]`.

Autoload loads `.ts` files directly because it detects Node's built-in type stripping.

## `@fastify/type-provider-typebox` + `typebox`

TypeBox schemas do three jobs at once: validate requests, serialize responses fast (and drop fields the schema doesn't list), and provide the TypeScript types for `request.body`, `request.params` and `request.query`.

```ts
import { Type } from "typebox";

const SendEmailBody = Type.Object({
  from: Type.String({ format: "email" }),
  to: Type.Array(Type.String({ format: "email" }), { minItems: 1, maxItems: 50 }),
  subject: Type.String({ minLength: 1 }),
  html: Type.Optional(Type.String()),
});

fastify.post(
  "/",
  {
    schema: {
      body: SendEmailBody,
      response: { 202: Type.Object({ id: Type.String() }) },
    },
  },
  async (request, reply) => {
    request.body.to; // typed as string[]
    return reply.code(202).send({ id: "em_123" });
  },
);
```

- **Type route plugins as `FastifyPluginAsyncTypebox`.** With a plain `FastifyPluginAsync`, `request.body` is `unknown`.
- **Always declare a `response` schema.** Anything not in it is removed from the response, so database columns can't leak out by accident.
- **Import from `typebox`** (v1), not `@sinclair/typebox` (v0.34, which the platform repo uses). The type provider expects v1.

## `env-schema`

`src/env.ts` defines and validates every environment variable when the app starts. If one is missing or invalid, the process exits immediately instead of failing on the first request.

**Add a variable:** add it to the schema in `src/env.ts`, give it a `/** comment */`, and add it to `apps/api/.env.example`. Read it anywhere as `fastify.config.MY_VAR`, fully typed. Never read `process.env` directly.

Tests override values without touching `process.env`: `buildApp({ env: { RATE_LIMIT_MAX: 2 } })`.

## `@fastify/bearer-auth`

Checks `Authorization: Bearer <key>` on every route under `src/routes/v1/`. Missing or unknown keys get a `401` before your handler runs.

**Read the caller's key:**

```ts
async (request) => {
  const keyId = request.apiKey!.id; // always set on /v1 routes
};
```

**How keys are checked:** `autohooks.ts` passes an `auth(token, request)` callback that calls `fastify.apiKeys.verify(token)` (`src/plugins/api-keys.ts`) and stores the result on `request.apiKey`. The store hashes the token with SHA-256 and looks it up in Postgres with `findActiveApiKeyByTokenHash` (`packages/db`), which ignores revoked keys. `request.apiKey` is `{ id, organizationId, permission }`; organization-scoped routes read `request.apiKey.organizationId`. Routes and hooks only use `verify()`, so the store can be swapped without touching them.

**Two kinds of key.** An *organization key* (stored hashed in `api_keys`) sets `request.apiKey`. The *root key* (`ROOT_API_KEY`, compared in constant time) sets `request.isRootKey` and belongs only to the operator. If `ROOT_API_KEY` is empty, no token matches it.

**Route access is organization-only by default.** A `preHandler` in `routes/v1/autohooks.ts` reads `config.access` and returns `403` when the wrong kind of key calls the route:

```ts
fastify.post("/", { config: { access: "root" }, schema: { ... } }, handler);
```

Omit `access` (or use `"organization"`) and the route requires an organization key, so the root key can never reach organization-scoped data by accident.

**Organization routes also require `full_access` by default.** A `sending_access` key gets `403` unless the route opts in with `config: { permission: "sending_access" }`, so a leaked send-only key can't mint itself a full-access one. `GET /v1/api-keys/current` opts in; sending email will too.

**`last_used_at`** is written by `verify()` at most once a minute per key (`touchApiKeyLastUsed`), so busy keys don't rewrite their row on every request.

**Bootstrap locally:** set `ROOT_API_KEY` in `.env`, start the API, and create an organization. The response carries its first key's token, shown only once:

```bash
curl -X POST localhost:8080/v1/organizations \
  -H "Authorization: Bearer $ROOT_API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Local"}'
```

**Errors:** the 401 body is `{ "error": "<reason>" }`. That's bearer-auth's own shape, not Fastify's `{ statusCode, error, message }`.

## `@fastify/rate-limit`

Limits each API key to `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW` on `/v1`. Over the limit returns `429` with `Retry-After`. Every response carries `x-ratelimit-limit`, `x-ratelimit-remaining` and `x-ratelimit-reset`.

- **The limit is per key, not per IP.** `keyGenerator` uses `request.apiKey.id`. That only works because the limit runs on `preHandler`, after bearer-auth's `onRequest` has set the key. Keep that order.
- **Override one route** (for example, a stricter limit on sending):

  ```ts
  fastify.post("/", {
    config: { rateLimit: { max: 10, timeWindow: "1 second" } },
    schema: { /* ... */ },
  }, handler);
  ```

  Set `config: { rateLimit: false }` to exempt a route.
- **Counters live in memory, per process.** That's fine for one instance. Once you run more than one, pass `redis` (from `@fastify/redis`) in the registration options so every instance shares one count.

## `@fastify/sensible`

Adds standard HTTP errors and small helpers, so routes don't hand-build error replies.

```ts
// throw from anywhere in a handler or service
throw fastify.httpErrors.notFound(`Email ${id} not found`);
throw fastify.httpErrors.conflict("Domain already exists");

// or reply directly
return reply.badRequest("`to` must contain at least one address");

// assertions throw the matching HTTP error
fastify.assert(domain.verified, 422, "Domain is not verified");
```

All of these produce Fastify's standard error body: `{ "statusCode": 404, "error": "Not Found", "message": "..." }`.

## `@fastify/under-pressure`

It does two jobs:

1. **Load shedding.** When the event loop is overloaded (delay above 1s, or utilization above 98%), every route returns `503` with `Retry-After: 10` instead of queueing more work. The thresholds are in `src/plugins/under-pressure.ts`.
2. **`GET /health`.** Under-pressure serves this route itself. It returns `{ "status": "ok", "uptime": ... }`, and returns `503` while the process is under pressure or when `healthCheck` fails. `healthCheck` pings Postgres (`select 1`). It needs no API key, and it logs only at warn level so load balancer probes don't flood the logs.

**A failed check sheds every route, not just `/health`.** Under-pressure runs `healthCheck` at startup and then every `healthCheckInterval` (5s). While it fails, the process counts as unhealthy and *every* request gets `503`. The interval is what lets the app recover once Postgres is back; without it, a database that was down at boot would leave the app returning `503` forever.

**Add a dependency check:** extend `healthCheck` in the same file. If it throws or returns `false`, the response is `503`. If it returns an object, that object is merged into the `200` body, and each new field must be added to `routeResponseSchemaOpts` or it gets removed from the response.

## `@fastify/swagger` + `@scalar/fastify-api-reference`

Swagger builds an OpenAPI 3 spec from every route's schema. Scalar renders it as browsable docs.

- **Docs UI:** `GET /docs/`
- **Raw spec:** `GET /docs/openapi.json` or `/docs/openapi.yaml`. Use this to generate the SDK in `packages/sdk`.

**Document a route:** the schema already defines the request and response, so just add the labels:

```ts
schema: {
  summary: "Send an email",
  description: "Queues the email and returns its id.",
  tags: ["Emails"],
  body: SendEmailBody,
  response: { 202: Type.Object({ id: Type.String() }) },
}
```

- **Auth in the spec:** every operation requires `bearerAuth` by default. A public route opts out with `security: []` in its schema, as `/health` does.
- **Hiding a route:** add `hide: true` to its schema.

## `@fastify/helmet`

Sets standard security headers (`X-Content-Type-Options`, `Strict-Transport-Security`, and others) on every response. The Content Security Policy is turned off because the `/docs` page runs an inline script that it would block. A CSP adds almost nothing to JSON responses, which is everything else this API serves.

---

## Testing

`tests/helpers.ts` exports `buildTestApp(env)`, which builds the real app with silent logs and closes it after the test, and `createTestKey(app)`, which migrates the database, seeds an organization with one key, returns its token, and deletes both afterwards. Send requests with `app.inject()`; no port is opened. Tests that need Postgres skip unless `DATABASE_URL` is set (`docker compose up -d`).

```ts
const app = await buildTestApp({ RATE_LIMIT_MAX: 2 });
const { token } = await createTestKey(app);
const res = await app.inject({
  method: "GET",
  url: "/v1/api-keys/current",
  headers: { authorization: `Bearer ${token}` },
});
```
