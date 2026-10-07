# atlair-mail

An open-source, self-hostable email sending service (a Resend/Plunk-style API on top of Amazon SES).

> Early scaffold: the API has health, API-key auth, rate limiting, and docs, but no email sending yet.

## Quick start

Requires Node 24+ and pnpm.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @atlair-mail/api dev
pnpm test
pnpm typecheck
```

Then try:

```bash
curl localhost:8080/health
curl -H "Authorization: Bearer am_test_change_me" localhost:8080/v1/api-keys/current
open http://localhost:8080/docs/        # API reference
```

## Repository structure

```
atlair-mail/
├── apps/
│   ├── api/              Fastify HTTP API (emails, domains, API keys, SES webhooks)
│   └── worker/           (planned) sends queued emails through a provider
├── packages/
│   ├── db/               (planned) Drizzle schema and Postgres client
│   ├── providers/        (planned) EmailProvider interface + SES / SMTP implementations
│   └── sdk/              (planned) npm client: mail.emails.send({...})
├── infra/terraform/      (planned) SES identities, configuration sets, SNS, IAM
└── docs/                 design notes
```

Inside `apps/api/src`:

```
server.ts      starts the HTTP server
app.ts         buildApp(): registers config, then autoloads plugins/ and routes/ (tests use this too)
env.ts         environment variables, validated at startup
config.ts      exposes env as fastify.config
plugins/       app-wide plugins, loaded automatically (api keys, docs, health, errors)
routes/        HTTP routes, loaded automatically; folders become URL prefixes
  v1/          authenticated API; autohooks.ts adds API-key auth and rate limiting
```

## Docs

- [docs/fastify-plugins.md](docs/fastify-plugins.md): each Fastify plugin we use and how to use it.
- [docs/design-patterns.md](docs/design-patterns.md): the design patterns this codebase uses and where.
- [AGENTS.md](AGENTS.md): conventions for AI coding agents.

## License

[AGPL-3.0](LICENSE)
