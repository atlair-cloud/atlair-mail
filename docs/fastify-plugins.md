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

**Add a public route group** (no API key), such as provider events: `src/routes/webhooks/provider-events/index.ts`. It sits outside `v1/`, so the v1 `autohooks.ts` doesn't apply.

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
- **`Type.Record` does not validate keys.** It emits `patternProperties`, so non-matching keys pass as extra properties (and Fastify's `removeAdditional` would silently drop them). Add `propertyNames: { pattern }` when keys matter, as `/v1/emails` does for header names.

## `env-schema`

`src/env.ts` defines and validates every environment variable when the app starts. If one is missing or invalid, the process exits immediately instead of failing on the first request.

**Add a variable:** add it to the schema in `src/env.ts` with a self-explanatory name, and add it to `apps/api/.env.example`. Read it anywhere as `fastify.config.MY_VAR`, fully typed. Never read `process.env` directly.

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

## Email provider and credential encryption

The public API never names a provider. Each organization connects one email provider with `PUT /v1/provider` (`full_access` only); the body is tagged by `type`, so a new provider adds a union member, not a route:

```json
{ "type": "ses", "region": "us-east-1", "accessKeyId": "AKIA...", "secretAccessKey": "..." }
```

**Provider code** lives in `packages/providers` (no Fastify or Postgres). `createProvider(config, { logger, retry })` returns an `EmailProvider` with `verifyAccount()`, `createDomain(name)`, `getDomain(name)` and `send(message)`, wrapped as `withRetry(withLogging(adapter))`. Tests use `createFakeProvider()` from `@atlair-mail/providers/testing`.

**Errors.** Adapters map every failure to a `ProviderError` subclass with an HTTP status and a `retryable` flag. Only the provider's error *name* reaches the client; the original error stays in `cause`.

| Code | HTTP | Meaning | Retried in-process |
| --- | --- | --- | --- |
| `ATL_PROVIDER_REJECTED` | 422 | Permanent: bad input or credentials, sandbox, unverified sender, suspended account | No |
| `ATL_PROVIDER_THROTTLED` | 429 | Rate or quota limit | Yes |
| `ATL_PROVIDER_UNAVAILABLE` | 502 | The request did not land: 5xx, connection refused, DNS failure | Yes |
| `ATL_PROVIDER_TIMEOUT` | 504 | No answer, so the outcome is unknown | Only for idempotent operations, **never for `send`** |

**Why a `send` timeout is never retried:** sending is not idempotent and SES has no idempotency key. If the request timed out after SES accepted it, a retry would deliver the email twice. The worker decides what to do with an unknown outcome.

**Retries** (`withRetry`, on `p-retry`): at most 3 attempts, exponential backoff from 200ms to 2s with jitter, 5s total. The SDK's own retries are off (`maxAttempts: 1`) so this is the only policy, and `throwOnRequestTimeout` makes the SDK's request timeout actually abort.

**Logging** (`withLogging`): one line per attempt with `provider`, `operation`, `durationMs`, `outcome`, `errorCode`, `retryable`, `recipientCount` and `providerMessageId`. Addresses, subject, body, headers and error messages are never logged. The API passes `fastify.log.child({ component: "provider" })`.

**Saving checks the credentials first** with `verifyAccount()`. Nothing is stored if it fails. The response reports `account.sandbox`, `dailyQuota` and `maxSendRate`.

**Storage** (`provider_connections`): `provider`, non-secret `settings` (jsonb, shown in responses) and `credentials_encrypted` (all secrets as one encrypted JSON blob). `fastify.services.providerConnections.requireProvider(organizationId)` is the only place that decrypts; it returns a ready `EmailProvider` or throws `ATL_PROVIDER_NOT_CONNECTED` (409).

**Encryption** lives in `packages/core` (`createCredentialsCipher`) on the AWS Encryption SDK (`@aws-crypto/client-node`):

- Envelope encryption: every value gets its own data key, wrapped by a raw AES-256 key from `CREDENTIALS_ENCRYPTION_KEYS`.
- The organization id is the encryption context, so a ciphertext copied into another organization's row does not decrypt.
- The algorithm suite is key-committing and unsigned (`ALG_AES256_GCM_IV12_TAG16_HKDF_SHA512_COMMIT_KEY`).

**Generate a key** (the app refuses to start without a valid one):

```bash
echo "CREDENTIALS_ENCRYPTION_KEYS=1:$(openssl rand -base64 32)" >> apps/api/.env
```

**Rotate:** prepend a new, higher-numbered key and keep the old one: `CREDENTIALS_ENCRYPTION_KEYS=2:<new>,1:<old>`. New writes use the highest version; existing rows still decrypt with theirs. `provider_connections.encryption_key_version` shows which rows still use an old key; once none do, the old key can be removed. Losing every key means organizations must reconnect their provider.

**Logs:** pino `redact` removes `req.headers.authorization`, any `secretAccessKey` and any `secrets` object, up to two levels deep.

**Add a provider:** add its settings and secrets types and a `case` in `createProvider` (`packages/providers`), add its value to `providerTypes`, add a union member to `ProviderInputSchema` and `toProviderConfig`, and run `pnpm --filter @atlair-mail/db generate` for the `provider` CHECK constraint.

### Amazon SES (`type: "ses"`)

`settings` = `{ region, accessKeyId, eventTopicArn?, configurationSetName?, eventQueueUrl?, eventDeadLetterQueueUrl? }`, secrets = `{ secretAccessKey }`. Everything after `accessKeyId` is written by event setup ([provider-events.md](provider-events.md)) and never returned. The delivery mode, push URL, confirmation and pull status are `events_*` columns because they are not provider-specific. `sandbox` is `true` until SES production access is granted. Least-privilege IAM policy for the connected key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AtlairMailSes",
      "Effect": "Allow",
      "Action": [
        "ses:GetAccount",
        "ses:CreateEmailIdentity",
        "ses:GetEmailIdentity",
        "ses:PutEmailIdentityMailFromAttributes",
        "ses:SendEmail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AtlairMailEventConfigurationSet",
      "Effect": "Allow",
      "Action": [
        "ses:CreateConfigurationSet",
        "ses:CreateConfigurationSetEventDestination",
        "ses:UpdateConfigurationSetEventDestination"
      ],
      "Resource": "arn:aws:ses:*:*:configuration-set/atlair-mail"
    },
    {
      "Sid": "AtlairMailEventTopic",
      "Effect": "Allow",
      "Action": [
        "sns:CreateTopic",
        "sns:SetTopicAttributes",
        "sns:Subscribe",
        "sns:ConfirmSubscription",
        "sns:ListSubscriptionsByTopic",
        "sns:Unsubscribe"
      ],
      "Resource": "arn:aws:sns:*:*:atlair-mail-events"
    },
    {
      "Sid": "AtlairMailEventQueues",
      "Effect": "Allow",
      "Action": [
        "sqs:GetQueueUrl",
        "sqs:CreateQueue",
        "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:SendMessage",
        "sqs:StartMessageMoveTask"
      ],
      "Resource": "arn:aws:sqs:*:*:atlair-mail-events-*"
    }
  ]
}
```

| Statement | Needed for |
| --- | --- |
| `AtlairMailSes` | Connecting, domains and sending. Identities are named by the customer, so this one stays `*`. |
| `AtlairMailEventConfigurationSet` | Event setup: only the `atlair-mail` configuration set. |
| `AtlairMailEventTopic` | Event setup and switching modes: only the `atlair-mail-events` topic. `ListSubscriptionsByTopic` and `Unsubscribe` are checked against the topic ARN. |
| `AtlairMailEventQueues` | Pull mode only: this connection's `atlair-mail-events-<connection id>` queue and its `-dlq`. `SendMessage` and `StartMessageMoveTask` are only used by `POST /v1/provider/events/redrive`; leave them out if you never redrive. |

## Domains

A sending domain is added with `POST /v1/domains` (`full_access`, a connected provider required). The service in `src/services/domains.ts` asks the organization's `EmailProvider` to register and check the domain, and stores the DNS records the provider returns in `domains.dns_records`.

**Names** are normalized by `src/lib/domain-names.ts`: trimmed, lowercased, trailing dot removed, unicode converted to punycode. `tldts` rejects IPs, `localhost`, unknown suffixes, and bare public suffixes such as `co.uk`. Subdomains such as `mail.example.com` are allowed.

**DNS records** come back in `records[]`, each with a `status` (`pending`, `verified`, `failed`, or `null` when the provider does not check it):

| record | type | name | required |
| --- | --- | --- | --- |
| `DKIM` | CNAME | from the provider | yes, needed to send |
| `MAIL_FROM` | MX (`priority`) | return path, `bounce.<domain>` | no, aligns SPF |
| `SPF` | TXT | return path, `bounce.<domain>` | no, aligns SPF |
| `DMARC` | TXT | `_dmarc.<domain>` = `v=DMARC1; p=none;` | no, added by the API |

The DMARC record sits on the sending domain itself, never its parent, so it cannot collide with a DMARC record the parent already has.

**Return path.** Once a domain is `verified`, create or verify calls `EmailProvider.configureReturnPath` if it has none. If the provider refuses (for example a missing IAM permission), verification still succeeds and the refusal is logged with its reason.

**Status:** `GET` returns what is stored and never calls the provider. `POST /v1/domains/:id/verify` asks the provider and updates `status` to `pending`, `verified` or `failed`; a domain the provider no longer knows becomes `failed`. Only `verified` domains can send.

**Existing registrations are adopted.** If the provider already has the domain, `POST` reads it instead of failing. `DELETE` removes the domain from atlair-mail only, so registrations the customer uses elsewhere are never deleted; it returns `409` while emails reference the domain.

### Amazon SES specifics

- Easy DKIM with 2048-bit keys: three CNAMEs, `<token>._domainkey.<domain>` → `<token>.<SigningHostedZone>`, with the zone taken from SES rather than hard-coded.
- `SUCCESS` and verified-for-sending → `verified`; `FAILED` or not found in the connection's region → `failed`; `PENDING`, `TEMPORARY_FAILURE`, `NOT_STARTED` → `pending`.
- SES checks DNS for 72 hours, then marks the domain failed. Fix the records, remove the domain, and add it again.
- Custom MAIL FROM is `bounce.<domain>` with `BehaviorOnMxFailure: USE_DEFAULT_VALUE`, so sending continues through amazonses.com until the MX record is found. Publish **exactly one** MX record there (`10 feedback-smtp.<region>.amazonses.com`) and `v=spf1 include:amazonses.com ~all`; do not send from or receive mail on that subdomain. SES checks for 72 hours.

## Emails

`POST /v1/emails` queues an email and returns **202** `{ id, status: "queued", scheduledAt, createdAt }`; the worker sends it. `GET /v1/emails/:id` returns it with its status. Both accept `sending_access` keys and are scoped to the caller's organization.

**Order of checks** (`src/services/emails.ts`):

1. Schema: shapes, lengths, no control characters anywhere, header names via `propertyNames`, a 5MB route `bodyLimit`.
2. Addresses: `parseMailbox` (`email-addresses`, RFC 5322) accepts exactly one dot-atom mailbox per entry and re-serializes it; groups, lists, quoted local parts, IP literals and non-public domains are rejected. At most 50 recipients across to, cc and bcc.
3. Headers: routing, identity and MIME headers (`From`, `To`, `Cc`, `Bcc`, `Reply-To`, `Sender`, `Return-Path`, `Message-ID`, `Date`, `MIME-Version`, `Content-*`, `DKIM-Signature`, `Received`) cannot be set.
4. `Idempotency-Key`: a repeat with the same normalized request returns the original email with `Idempotent-Replayed: true`; a different request gets `422 ATL_IDEMPOTENCY_KEY_REUSED` (IETF draft semantics). The fingerprint is SHA-256 over the request serialized with `safe-stable-stringify`. Keys are scoped to the organization and kept for the life of the email.
5. The From domain must be `verified` in the caller's organization (`422 ATL_DOMAIN_NOT_VERIFIED`).
6. No recipient may be in the organization's suppression list (`422 ATL_RECIPIENT_SUPPRESSED`). See [suppressions.md](suppressions.md) for how entries are added and `/v1/suppressions`.

`scheduledAt` may be up to 30 days ahead; a past time means now. Request bodies are never logged.

`lastError` explains a failure as `CODE` or `CODE: Reason`, where the reason is the provider's error name only (for example `ATL_PROVIDER_REJECTED: MessageRejected`, which in the SES sandbox usually means the recipient is not verified). Provider messages are never stored because they can contain addresses.

**Status** follows the transition table in `packages/core/src/email-status.ts`; see [email-lifecycle.md](email-lifecycle.md) for the table, how provider events move it, and why order and repeats do not matter.

`GET /v1/emails/:id/events` returns the provider events for an email, oldest first, as `{ data: [{ id, type, occurredAt, recipients: [{ address, diagnosticCode? }], bounce?, complaint?, smtpResponse?, link? }] }`. It accepts `sending_access` keys and returns 404 for another organization's email.

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
- **Public webhooks have their own limit.** `/webhooks/provider-events` registers rate-limit in its own scope, keyed by IP, 3000 requests per minute.
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
