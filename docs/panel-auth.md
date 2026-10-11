# Panel auth: users, organizations, members, roles

Status: implemented (ATL-100).

atlair-mail is self-hosted, so the panel has its own login rather than depending on another Atlair
service. People sign in with GitHub or Google through Better Auth (a self-hoster registers their own
OAuth app); there is no email and password sign-in. Apps keep using API keys; the operator
keeps `ROOT_API_KEY`. The organization, member, and role model copies `atlair-platform`
(`identity.organization/role/member/audit_log`, `seed.ts` `ROLE_PERMISSIONS`, `resolveMembership` +
`requirePermission`), written in this repo's conventions.

| Identity | Credential | Surface |
|---|---|---|
| Apps and servers | API key (`Bearer`) | `/service/web/*` |
| People | Better Auth session cookie | `/api/auth/*`, `/service/panel/*` |
| Operator automation | `ROOT_API_KEY` | root routes under `/service/web` |

Cookies never authenticate `/service/web`, and API keys never authenticate `/service/panel`. Each surface has one
credential, so `/service/web` needs no CSRF handling.

## Route prefixes

| Prefix | Who | Credential |
|---|---|---|
| `/service/web` | Public API: apps, servers, the SDK | API key, or `ROOT_API_KEY` on root routes |
| `/service/panel` | Protected API: signed-in people using the panel | Better Auth session cookie |
| `/api/auth` | Better Auth (GitHub and Google sign-in, sessions, OAuth callbacks) | none / session |
| `/webhooks/provider-events/:connectionId`, `/health`, `/docs` | unchanged | |

`/service/web` replaces `/v1`. Nothing published depends on `/v1` yet (`packages/sdk` is still
empty), so the rename happens now, with no alias:

- `routes/v1/` moves to `routes/service/web/`, `autohooks.ts` included; autoload derives the prefix
  from the folders.
- Paths in error messages and schema descriptions (`services/emails.ts`,
  `services/provider-connections.ts`, `schemas/provider-connections.ts`), tests, `README.md`, and
  `docs/*.md` change to `/service/web`.

## Versioning

The version travels in a header, not the URL, like NestJS `VersioningType.HEADER` with a
`defaultVersion`:

```
GET /service/web/emails/:id
Api-Version: 1
```

- **Header:** `Api-Version`, an integer as a string (`"1"`, `"2"`). Applies to `/service/web` and
  `/service/panel`.
- **Default:** a request without the header is served as version `1`. The default stays pinned to
  `1` when a `2` ships, so existing callers never change behavior; newer versions must be asked for.
- **Unsupported version:** `400` "Unsupported API version", listing the supported ones. Not a 404,
  so a typo in the header isn't mistaken for a missing resource.
- **Response:** every versioned response carries `Api-Version` (the version that served it) and
  `Vary: Api-Version`.
- **Version-neutral:** `/api/auth/*`, `/webhooks/*`, `/health`, `/docs` take no constraint and answer
  any version (Nest `VERSION_NEUTRAL`).

### How it works (`plugins/api-version.ts`)

- A Fastify custom constraint strategy, `apiVersion`, registered through the server's
  `constraints` option in `app.ts`. `deriveConstraint` reads `Api-Version` and returns the default
  (`"1"`) when it is absent. Its store accepts a list, so one route can serve several versions.
- An `onRoute` hook under `routes/service/` sets `constraints.apiVersion` from the route's
  `config.version` (default `["1"]`). Routes declare versions the way Nest's `@Version()` does:

  ```
  config: { version: ["1"] }
  config: { version: ["1", "2"] }
  ```

  A route that doesn't change in a new version just adds the number; only routes that change get a
  second definition. No version folders.
- The not-found handler answers `400` when `Api-Version` names a version no route serves.
- `onSend` sets `Api-Version` and `Vary`.
- CORS allows the `Api-Version` request header and exposes it on responses.
- OpenAPI: `@fastify/swagger` documents `Api-Version` as an optional header on every versioned
  route, with the default.
- `packages/sdk` will send `Api-Version` explicitly, pinned per SDK major version.

## Enabling it

Panel auth is on when `BETTER_AUTH_SECRET` is set. Without it, `/api/auth` and `/service/panel` are
not registered and atlair-mail stays API-only, as today.

| Variable | Default | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | empty (off) | 32+ chars, `openssl rand -base64 32`. Rejected if shorter. |
| `BETTER_AUTH_URL` | required when on | Public API origin, `https://` in production. |
| `PANEL_ORIGINS` | required when on | Comma-separated origins, e.g. `https://mail.example.com`. Feeds CORS, Better Auth `trustedOrigins`, and the panel origin check. |
| `AUTH_SIGNUP` | `open` | `open` or `disabled`. `disabled` stops a provider sign-in from creating a new account. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | empty | Provider is offered only when both are set. At least one of GitHub or Google is required when the panel is on. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | empty | Same. |

The panel UI is a separate static deploy, so it must be same-site with the API (for example
`mail.example.com` and `api.mail.example.com`). Browsers drop `SameSite=Lax` cookies across sites.
The self-host docs say so.

## Database (`packages/db`, migration `0014_panel_auth`)

Additive, one migration. All timestamps `timestamptz`; IDs UUIDv7 (Better Auth configured with
`advanced.database.generateId` returning `uuidv7()`), stored as `uuid`.

### `auth` schema (Better Auth core, no organization plugin)

`auth.user`, `auth.session`, `auth.account`, `auth.verification`, `auth.rate_limit`, generated with
`npx auth@latest generate` and then edited to match `_columns.ts` (`id()`, `timestamptz`). Indexes:
`user.email` unique, `session.token` unique, `session(user_id)`, `account(user_id)`,
`account(provider_id, account_id)` unique, `verification(identifier)`.

### `organizations` (extended)

| Column | Change |
|---|---|
| `slug` | `text not null`, `uniqueIndex`, check `^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$`. Backfilled in the migration as `slugify(name)` (36 chars, `org` when empty) `|| '-' || right(id::text, 12)`, then set `not null`. New organizations get `slugify(name)-<8 random hex>` unless a slug is given. |
| `metadata` | `jsonb`, nullable |
| `created_by` | `uuid` → `auth.user`, nullable (root-created orgs have no user), `on delete set null` |
| `updated_by` | same |
| `deactivated_at` | `timestamptz`, nullable. Deactivated organizations drop out of every member's list and answer `404`. |

### `roles`

`id`, `organization_id` → `organizations` (`restrict`), `name text`, `permissions text[] not null`,
`created_by`, `updated_by`, timestamps. `uniqueIndex(organization_id, name)` (also serves lookups by
org). Check `cardinality(permissions) > 0`. Seeded per org with `owner`, `admin`, `member`.

### `members`

`id`, `organization_id` → `organizations` (`restrict`), `user_id` → `auth.user` (`cascade`),
`role_id` → `roles` (`restrict`), `created_by`, `updated_by`, timestamps.
`uniqueIndex(organization_id, user_id)` (also covers lookups by org); `index(user_id)` for
"my organizations" and the FK.

### `audit_logs`

`id`, `organization_id` (nullable, `set null`), `actor_user_id` (nullable, `set null`),
`actor_api_key_id` (nullable, `set null`, migration 0022), `action`, `entity_type`, `entity_id`,
`changes jsonb`, `created_at`. `index(organization_id, id)` for pagination (newest first,
`before=<id>`, as elsewhere in this API), `index(entity_type, entity_id)`. Append-only: no `updated_at`.

Services write entries with `recordAudit(tx, { organizationId, actor, action, entityType, entityId, changes })`
inside the same transaction as the change, so an entry exists exactly when the change committed.
A request made with an API key fills `actor_api_key_id`; one from the panel fills `actor_user_id`.
`changes` keeps the names a reader needs (template name, domain, webhook URL, address), so entries
for deleted things stay readable. It never holds secrets.

| Area | Actions |
| --- | --- |
| Organization, members | `organization.created/updated/deactivated`, `member.added/role_updated/removed` |
| API keys | `api_key.created`, `api_key.revoked` |
| Domains | `domain.added`, `domain.verified`, `domain.verification_lost`, `domain.removed` |
| Templates | `template.created`, `template.renamed` (name or alias; draft edits are not recorded), `template.published`, `template.restored`, `template.rolled_back`, `template.deleted` |
| Webhooks | `webhook.created/updated/enabled/disabled/secret_rotated/deleted` |
| Suppressions | `suppression.added`, `suppression.removed` (manual changes; bounces and complaints are on the email) |
| Provider | `provider.connected`, `provider.credentials_replaced`, `provider.disconnected`, `provider.events_enabled`, `provider.events_changed`, `provider.events_redriven` |

Sent emails are not audited: the emails table is their record.

Repositories follow the existing shape: functions taking an `Executor` first, one query each, in
`packages/db/src/repositories/{users,roles,members,audit-logs}.ts`; `organizations.ts` gains
`listOrganizationsForUser` (newest first, `before=<id>`), `findOrganizationBySlug`,
`updateOrganization`, `deactivateOrganization`.

## Permissions (`packages/db/src/types.ts`)

```
organization:view  organization:update  organization:delete
member:view        member:invite        member:remove        member:update_role
audit:view
api_key:view       api_key:create       api_key:revoke
provider:view      provider:connect     provider:disconnect
domain:view        domain:create        domain:verify        domain:delete
email:view         email:send
webhook:view       webhook:create       webhook:update       webhook:delete
suppression:view   suppression:create   suppression:delete
```

`owner`: all. `admin`: all except `organization:delete`. `member`: every `:view` plus `email:send`.
`rolePermissions` and `seedOrganizationRoles(tx, organizationId, createdBy)` live in
`packages/db/src/roles.ts`, as in the platform's `seed.ts`. The migration seeds the same three roles
for organizations that already exist. `member` gets every `:view` except `audit:view`, plus
`email:send`.

## API (`apps/api`)

### `plugins/auth.ts`

`fp`, `{ name: "auth", dependencies: ["config", "db"] }`, skipped when `BETTER_AUTH_SECRET` is empty.

- Builds the `betterAuth` instance (`drizzleAdapter(db, { provider: "pg" })`) and decorates
  `fastify.auth`.
- `decorateRequest("user", null)` and `decorateRequest("session", null)`.
- Mounts `GET|POST /api/auth/*`, forwarding to `auth.handler` the way the platform's `plugins/auth.ts`
  does (rebuild a web `Request`, copy status and headers back).
- Decorates `fastify.requireSession`: `auth.api.getSession({ headers })`, sets `request.user` and
  `request.session`, otherwise `httpErrors.unauthorized()`.
- Registers `@fastify/cors` with `origin: PANEL_ORIGINS`, `credentials: true`, methods
  `GET, POST, PATCH, PUT, DELETE`.

Better Auth config:

| Setting | Value | Why |
|---|---|---|
| `emailAndPassword` | `enabled: false` | Sign-in is GitHub or Google only; no passwords to store, reset or rate limit. |
| `requireEmailVerification` | `false` | No auth email channel yet; see "Later". |
| `socialProviders` | GitHub / Google when configured, `disableSignUp` from `AUTH_SIGNUP` | The OAuth app's callback URL is `${BETTER_AUTH_URL}/api/auth/callback/<provider>`. |
| `trustedOrigins` | `PANEL_ORIGINS` | Validates `origin`, `callbackURL`, `errorCallbackURL`. |
| `session` | `expiresIn` 7d, `updateAge` 1d, `freshAge` 1h, no `cookieCache` | Revocation and membership changes apply on the next request. |
| `rateLimit` | `enabled: true`, `storage: "database"`, `/sign-in/social` 10/60s | Shared across API instances. |
| `account` | `encryptOAuthTokens: true`, `accountLinking` with `trustedProviders: ["github", "google"]` | Tokens are not used, but never stored in plain text. GitHub and Google sign-ins with the same verified email land on one user. |
| `advanced` | `cookiePrefix: "atlair-mail"`, `useSecureCookies` when `BETTER_AUTH_URL` is https, `ipAddress.ipAddressHeaders: ["x-atlair-mail-client-ip"]` (set from Fastify's `request.ip`; client values are overwritten), `generateId: uuidv7` | CSRF and origin checks stay on (defaults). |
| `databaseHooks` | `user.create.after` → `user.signed_up`, `session.create.after` → `session.created`, `account.create.after` → `account.linked` | Written to `audit_logs` with `organization_id` null. |

The logger also redacts `req.headers.cookie` and `res.headers["set-cookie"]`.

### Routes

```
routes/service/panel/
  autohooks.ts                         requireSession; origin check (below)
  me/index.ts                          GET   current user
  organizations/index.ts               GET   list mine (newest first)    POST create
                                       GET   /slug-availability?slug=
  organizations/_organizationId/
    autohooks.ts                       resolveMembership; permission check
    index.ts                           GET  PATCH  DELETE (deactivate)
    members/index.ts                   GET  POST {email, role}  PATCH /:memberId {role}  DELETE /:memberId
    roles/index.ts                     GET
    audit-log/index.ts                 GET (newest first)
    overview/index.ts                  GET  setup, health, attention, domains, recent emails (see web.md)
```

- **Origin check** (`routes/service/panel/autohooks.ts`, `onRequest`): for non-`GET`/`HEAD`, the `Origin`
  header must be in `PANEL_ORIGINS`, otherwise 403. Together with `SameSite=Lax` cookies and body
  schemas that only accept JSON objects, this is the CSRF
  defense for cookie-authenticated writes.
- **Membership** (`onRequest` in `_organizationId/autohooks.ts`, after the session hook): one query
  joining `members → roles → organizations` for `(organizationId, request.user.id)` where the org is
  not deactivated. A malformed id or a non-member gets **404** "Organization not found", before the
  body is read, so org IDs can't be probed. Sets
  `request.membership = { memberId, organizationId, roleName, permissions }`.
- **Permissions** are declared per route as `config: { permissions: ["member:invite"] }`, and the
  same autohook checks them against `request.membership.permissions` (403). This mirrors the
  platform's `requirePermission` in this repo's `config.access` idiom. An `onRoute` hook
  makes a route under `_organizationId` without `config.permissions` fail at startup, so none is
  left unchecked.
- Every route has TypeBox `params`/`body`/`response` schemas, `summary`, and `tags`; errors come from
  `fastify.httpErrors`.

### Services (`apps/api/src/services`)

Same rules as the platform's `organization.service.ts` and `member.service.ts`:

- `organizations.createForUser`: one transaction inserts the org (slug from input or
  `slugify(name)-<8 random hex>`), seeds roles, adds the creator as `owner`, writes
  `organization.created`. Root `create` also seeds roles and keeps returning the first API key.
  A taken slug is `409 ATL_SLUG_TAKEN`.
- `organizations.update` / `deactivate`: audited with before/after `changes`.
- `members.add` by email of an **existing user** (case-insensitive): `404 ATL_USER_NOT_FOUND`,
  `400 ATL_ROLE_NOT_FOUND`, `409 ATL_ALREADY_MEMBER`. No invitation emails.
- `members.updateRole` / `remove`: `409 ATL_OWNER_PROTECTED` for the owner,
  `400 ATL_OWNER_GRANT` when granting `owner`. Exactly one owner per org.
- Errors are `@fastify/error` classes thrown from the service, like the rest of this API.
- Every mutation writes an `audit_logs` row in the same transaction.

### Root-created organizations

Orgs made with `ROOT_API_KEY` (including Atlair Cloud's provisioning) have no members.
`POST /service/web/organizations/:id/members { email, role }` (`access: "root"`) assigns a member, so the
operator can hand an org to its owner. `role: "owner"` is accepted only while the org has no owner. `POST /service/web/organizations` also accepts an optional `slug`.

## Tests

`buildPanelTestApp()` (panel env with a fake GitHub app), `app.inject()`. `signUp()` creates users and
sessions through a test-only Better Auth instance with the `testUtils` plugin (same options, database
and secret); the app itself never loads that plugin.

- Auth off when `BETTER_AUTH_SECRET` is empty: `/api/auth/*` and `/service/panel/*` are 404.
- Email and password endpoints are off; GitHub sign-in starts with the right redirect URL.
- `AUTH_SIGNUP=disabled` sets `disableSignUp` on providers.
- Social sign-in rate limit returns 429 after 10 attempts.
- Unauthenticated `/service/panel` is 401; a session cookie on `/service/web` is 401.
- Cross-tenant: a user of org A gets 404 on every org B route.
- Permissions: `member` gets 403 on writes; `admin` can't delete the org; owner protections hold.
- Origin check: a write with a foreign or missing `Origin` is 403; `GET` passes.
- Create org seeds three roles and an owner, and writes the audit row, atomically.
- Every route under `_organizationId` declares `config.permissions`.
- Migration backfills `slug` for existing orgs.
- Versioning: no `Api-Version` is served as `1`; `Api-Version: 1` likewise; `Api-Version: 9` is 400;
  responses carry `Api-Version` and `Vary`; `/health` and `/api/auth/*` ignore the header; a route
  with `config.version: ["1", "2"]` answers both.

## Email resources on the panel (ATL-101)

Domains, API keys, provider, emails, webhooks and suppressions are defined once in
`apps/api/src/resources/` and registered on both surfaces, so `/service/panel/organizations/:id/<resource>`
answers with the same bodies and statuses as `/service/web/<resource>`. See "Add an organization
resource route" in `fastify-plugins.md`.

| Resource | Read | Write |
| --- | --- | --- |
| API keys | `api_key:view` | `api_key:create`, `api_key:revoke` |
| Domains | `domain:view` | `domain:create`, `domain:verify`, `domain:delete` |
| Provider | `provider:view` | `provider:connect` (connect, events, redrive), `provider:disconnect` |
| Emails | `email:view` (list, get, events) | `email:send` |
| Webhooks | `webhook:view` (incl. deliveries) | `webhook:create`, `webhook:update` (incl. rotate), `webhook:delete` |
| Suppressions | `suppression:view` | `suppression:create`, `suppression:delete` |

- `GET /emails` (both surfaces): newest first, without bodies, `before` + `limit` (1–100, default 50)
  and an optional `status` filter. Backed by `emails(organization_id, id)` (migration `0015`).
- Emails sent from the panel store no API key (`api_key_id` is null).
- Panel routes are rate limited per signed-in user with the same `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW`
  as API keys.
- Resource changes made through the panel are not written to `audit_logs` yet.

## Out of scope

- The panel UI: it lives in `apps/web`, see [web.md](web.md).
- Later: auth emails (invitations) through atlair-mail's own sending;
  generic OIDC for "Sign in with Atlair" and other identity providers; 2FA.
