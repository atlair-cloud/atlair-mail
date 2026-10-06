# atlair-mail

An open-source, self-hostable email sending service (a Resend/Plunk-style API on top of Amazon SES).

> Early scaffold: right now only the API with a `/health` endpoint exists.

## Quick start

Requires Node 24+ and pnpm.

```bash
pnpm install
pnpm --filter @atlair-mail/api dev     # http://localhost:8080/health
pnpm test
pnpm typecheck
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
app.ts         buildApp(): registers plugins and routes (tests use this too)
env.ts         environment variables, validated at startup
plugins/       shared app-wide plugins (config, later db, auth)
routes/        HTTP routes, one file per resource
```

## Docs

- [docs/design-patterns.md](docs/design-patterns.md): the design patterns this codebase uses and where.
- [AGENTS.md](AGENTS.md): conventions for AI coding agents.

## License

[AGPL-3.0](LICENSE)
