# AGENTS.md

atlair-mail is an open-source (AGPL-3.0, see `LICENSE`), self-hostable email sending API on top of Amazon SES. It is
independent of `atlair-platform`: Atlair consumes it through the public API/SDK like any other
user, so anything Atlair needs is built as a general feature, never a platform-specific shortcut.

## Commands

Run from the repo root (pnpm workspaces + Turborepo). Scripts live in each `package.json`.

```bash
pnpm install
pnpm --filter @atlair-mail/api dev   # node --watch, http://localhost:8080/health
pnpm test                            # node --test, uses app.inject()
pnpm typecheck                       # tsc, no emit
```

A change is done when `pnpm typecheck` and `pnpm test` both pass.

## TypeScript runs natively

Node 24 strips types at runtime: there is no build step, no tsx, and no `build/` for apps.

- Relative imports use the **`.ts` extension**: `import { buildApp } from "./app.ts"`.
- Only erasable syntax (`erasableSyntaxOnly`). Write union types and `as const` objects in place of
  `enum`, `namespace`, and constructor parameter properties.
- Type-only imports use `import type` (`verbatimModuleSyntax`).

## Fastify conventions

- `app.ts` exports `buildApp(opts)`; `server.ts` only listens. Tests call `buildApp()` and use
  `app.inject()`, never a real port.
- Every route declares a TypeBox schema (`typebox` package, `FastifyPluginAsyncTypebox`) for
  params, body, and **response**. The response schema drives fast serialization and keeps fields from leaking.
- Config comes only from `fastify.config` (validated by `env-schema` in `src/env.ts`). Add new env
  vars there and to `.env.example`.
- Shared app-wide state goes in `src/plugins/` wrapped with `fastify-plugin`; route files stay encapsulated.
- Prefer official `@fastify/*` plugins (https://fastify.dev/ecosystem/) over hand-rolled
  equivalents: `@fastify/rate-limit`, `@fastify/under-pressure`, `@fastify/swagger`.

## Architecture

Layering is `routes → services → repositories → db`. Providers sit behind an `EmailProvider`
interface. Before adding a domain module, provider, worker step, or status transition, read
[docs/design-patterns.md](docs/design-patterns.md); it maps each pattern to its location.

Placeholder directories (`apps/worker`, `packages/*`, `infra/terraform`) hold a `.gitkeep` until
their first real file lands; delete the `.gitkeep` then.
