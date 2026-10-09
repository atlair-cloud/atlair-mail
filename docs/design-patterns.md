# Design patterns

The patterns we use, where they live, and why. Names and definitions follow
[refactoring.guru](https://refactoring.guru/design-patterns/catalog). This is a plan: most of these
land with the feature that needs them, and none exist yet beyond the API skeleton.

A pattern earns its place by isolating something that varies: the provider, the delivery pipeline,
the email lifecycle. When a plain function does the job, write a plain function.

For the system shape (runtime, tenancy, data model, the send pipeline, and the Postgres-queue
decision), see [architecture.md](architecture.md).

## How a send flows

```
POST /emails ──▶ route ──▶ EmailService ──▶ EmailRepository (status = queued)
                                                   │
worker claims queued rows ◀────────────────────────┘
        │
        ▼
 pre-send chain (suppression → domain verified → rate limit)
        │
        ▼
 EmailProvider (Retrying(Logging(SesProvider)))  ──▶ SES
        │
SES events ──SNS──▶ POST /webhooks/provider-events/:connectionId ──▶ status transition ──▶ notify customer webhooks
```

## Layering (architectural, not GoF)

`routes → services → repositories → db`, the same as `atlair-platform/apps/api`:

- **Routes** handle HTTP only: schema validation and calls to `fastify.services.*`.
- **Services** hold business rules and own transaction boundaries.
- **Repositories** each run one query per method and take the executor (`db` or `tx`) as their first argument.

Services and repositories are exposed as Fastify decorators through `fastify-plugin`. This is our
dependency injection, so tests can swap any layer.

## Patterns

| Pattern | Where | Why |
| --- | --- | --- |
| [Adapter](https://refactoring.guru/design-patterns/adapter) | `packages/providers/src/ses/ses-provider.ts` | Wraps the AWS SDK behind our own `EmailProvider` interface (`verifyAccount`, `createDomain`, `getDomain`, `send`). SES types and errors never leak past this file; failures become `ProviderError` with a `retryable` flag. |
| [Strategy](https://refactoring.guru/design-patterns/strategy) | `EmailProvider` consumers (worker) | The worker depends on the interface. Self-hosters switch between SES, SMTP, and Postmark with config, not code. |
| [Factory Method](https://refactoring.guru/design-patterns/factory-method) | `createProvider(config)` in `packages/providers` | The one place that builds the matching adapter from an organization's `provider_connections` row (type, settings, decrypted secrets). It runs **per organization**, not once per process. |
| [Decorator](https://refactoring.guru/design-patterns/decorator) | `withRetry(provider)`, `withLogging(provider, logger)` in `packages/providers` | `createProvider` returns `withRetry(withLogging(adapter))`, so every attempt is logged. Retries use `p-retry`; logging writes metadata only, never addresses or content. Each wrapper also implements `EmailProvider`. |
| [Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility) | Worker pre-send checks | Ordered checks (suppression list, verified domain, per-key rate limit). Each check either passes or stops the send with a reason, and adding a check doesn't touch the others. On the API side, Fastify hooks (`onRequest`/`preHandler`) already give us this chain for auth. |
| [State](https://refactoring.guru/design-patterns/state) | `email-status.ts` (domain module) | Lifecycle `queued → sending → sent → delivered \| bounced \| complained \| failed`. The worker's moves use a transition table (`canTransition`). After that the status is computed from all of the email's provider events (`statusFromEvents`, per recipient), because events arrive out of order and duplicated. See [email-lifecycle.md](email-lifecycle.md). |
| [Observer](https://refactoring.guru/design-patterns/observer) | Status change → customer webhooks | Services publish `email.delivered`, `email.bounced`, and similar events. Subscribers (outbound webhooks, suppression-list updater) react without the service knowing about them. Persist the events through an outbox table so they survive restarts. |
| [Command](https://refactoring.guru/design-patterns/command) | The queued `email` row | Each send request is stored as data and run later by the worker, which gives us retries, scheduling (`send_at`), and an audit trail for free. |
| [Facade](https://refactoring.guru/design-patterns/facade) | `packages/sdk` | `mail.emails.send({...})` hides HTTP, auth headers, retries, and error mapping from SDK users. |

## Deliberately avoided

- **Singleton.** Shared clients (db pool, provider) are Fastify decorators created in `buildApp()`, so tests get fresh instances.
- **Class hierarchies for entities.** Use plain data types plus functions, inferred from the Drizzle schema.
