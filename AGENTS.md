# AGENTS.md

atlair-mail is an open-source (AGPL-3.0, see `LICENSE`), self-hostable email sending API on top of Amazon SES. It is
independent of `atlair-platform`: Atlair consumes it through the public API/SDK like any other
user, so anything Atlair needs is built as a general feature, never a platform-specific shortcut.

## Commands

Run from the repo root (pnpm workspaces + Turborepo). Scripts live in each `package.json`.

```bash
pnpm install
docker compose up -d --wait          # Postgres on :5432 (see apps/api/.env.example)
export DATABASE_URL=postgres://atlair:atlair@localhost:5432/atlair_mail
pnpm --filter @atlair-mail/db migrate
pnpm --filter @atlair-mail/api dev   # node --watch, http://localhost:8080/health
pnpm --filter @atlair-mail/worker dev  # sends queued emails, see docs/worker.md
docker compose exec postgres createdb -U atlair atlair_mail_test   # once
DATABASE_URL=postgres://atlair:atlair@localhost:5432/atlair_mail_test pnpm test   # one package at a time
pnpm typecheck                       # tsc, no emit
```

A change is done when `pnpm typecheck` and `pnpm test` both pass. DB tests skip without
`DATABASE_URL`, so run them with Postgres up, against `atlair_mail_test`: a dev worker running on
`atlair_mail` would otherwise claim the tests' queued emails.

## TypeScript runs natively

Node 24 strips types at runtime: there is no build step, no tsx, and no `build/` for apps.

- Relative imports use the **`.ts` extension**: `import { buildApp } from "./app.ts"`.
- Only erasable syntax (`erasableSyntaxOnly`). Write union types and `as const` objects in place of
  `enum`, `namespace`, and constructor parameter properties.
- Type-only imports use `import type` (`verbatimModuleSyntax`).
- **No comments in code**, including JSDoc. Names carry the meaning; the reason behind a
  non-obvious choice goes in `docs/` or the PR description.

## Fastify conventions

Before adding a route, plugin, env var, or health check, read
[docs/fastify-plugins.md](docs/fastify-plugins.md): it covers each plugin's setup and usage.

- `@fastify/autoload` owns registration. Add a route by adding a file under `src/routes/` (folders are
  URL prefixes) and an app-wide plugin by adding an `fp`-wrapped file under `src/plugins/`. `app.ts`
  stays unchanged.
- Folder-wide hooks go in that folder's `autohooks.ts`. `routes/v1/autohooks.ts` applies API-key
  auth then per-key rate limiting to all of `/v1`; public routes (webhooks) live outside `v1/`.
- Every route declares a TypeBox schema (`typebox` v1, `FastifyPluginAsyncTypebox`) for params,
  body, and **response**, plus `summary`/`tags`; the response schema strips unlisted fields and
  feeds the `/docs` OpenAPI spec.
- Config comes only from `fastify.config` (`src/env.ts`); add new vars there and to `.env.example`.
- HTTP errors come from `@fastify/sensible` (`fastify.httpErrors.notFound(...)`).
- Tests use `buildTestApp()` from `tests/helpers.ts` and `app.inject()`; a real port is never opened.
- Reach for an official `@fastify/*` plugin (https://fastify.dev/ecosystem/) before writing your own.

## Architecture

Layering is `routes → services → repositories → db`. Providers sit behind an `EmailProvider`
interface. Before adding a domain module, provider, worker step, or status transition, read
[docs/design-patterns.md](docs/design-patterns.md); it maps each pattern to its location.

Placeholder directories (`apps/worker`, `packages/*`, `infra/terraform`) hold a `.gitkeep` until
their first real file lands; delete the `.gitkeep` then.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
