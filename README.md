# atlair-mail

Send email from your app with one HTTP request, through your own Amazon SES account.

atlair-mail is an open-source alternative to services like Resend or Plunk. You get a simple email
API, a web panel, templates, and webhooks, but the emails go out through **your** AWS account. Your
sending reputation stays yours, and you pay AWS directly instead of a markup: $0.10 per 1,000 emails
on SES's pay-as-you-go pricing, or $0.16 on the Essentials plan new SES accounts start on
([SES pricing](https://aws.amazon.com/ses/pricing/)). You can use the hosted version or run the whole
thing yourself.

```bash
curl -X POST https://api.atlair.cloud/mail/service/web/emails \
  -H "Authorization: Bearer $ATLAIR_MAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <hello@example.com>",
    "to": ["you@example.com"],
    "subject": "It works",
    "text": "Sent with Atlair Mail."
  }'
```

## What it does

- **Send email** over a REST API, with safe retries (`Idempotency-Key`) and scheduled sending.
- **Track every email**: sent, delivered, bounced, marked as spam, and (if you turn on tracking in
  SES) opened and clicked.
- **Templates** with variables, so your app sends data and atlair-mail builds the email.
- **Webhooks** that tell your app when something happens to an email.
- **Suppressions**: addresses that bounced or complained are skipped automatically.
- **A web panel** to connect SES, verify domains, create API keys, and see what was sent.
- **Teams**: organizations with members and roles.

## Use the hosted version

1. Sign in at [mail.atlair.cloud](https://mail.atlair.cloud) and create an organization.
2. Connect your Amazon SES account and add your domain.
3. Create an API key and send your first email.

The [API docs](https://docs.atlair.cloud) walk through each step, including setting up SES from
scratch, and let you try every request in the browser.

## Run it yourself

You need Node 24+, pnpm, and Docker (for Postgres).

```bash
pnpm install
docker compose up -d --wait                    # starts Postgres on localhost:5432

cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

Fill in the secrets in both `.env` files:

- `CREDENTIALS_ENCRYPTION_KEYS`: `1:` followed by the output of `openssl rand -base64 32`. Use the
  **same value** in the API and the worker, since it encrypts your SES credentials.
- `BETTER_AUTH_SECRET` (API only): any long random string, for example `openssl rand -base64 32`.

Then create the database tables and start everything, each in its own terminal:

```bash
export DATABASE_URL=postgres://atlair:atlair@localhost:5432/atlair_mail
pnpm --filter @atlair-mail/db migrate

pnpm --filter @atlair-mail/api dev      # the API, on http://localhost:8080
pnpm --filter @atlair-mail/worker dev   # sends queued emails in the background
pnpm --filter @atlair-mail/web dev      # the panel, on http://localhost:5173
```

Open the panel at http://localhost:5173, sign up, connect SES, and create an API key. The API
reference for your instance is at http://localhost:8080/docs/.

For production, `compose.prod.yaml` builds and runs the API and the worker as containers. Point them at
any Postgres database with a root `.env` file.

## How it works

```
your app ──► API ──► Postgres (queue) ──► worker ──► Amazon SES ──► inbox
                          ▲                                 │
                          └──── delivery, bounce, open ◄────┘
                                events ──► your webhooks
```

The API saves each email to Postgres and answers right away. A separate worker process picks emails
off the queue, checks them (domain verified, recipient not suppressed), and hands them to SES. SES
reports back what happened, and atlair-mail records it and forwards it to your webhooks. Postgres is
the only thing you need to run besides the two processes: there is no Redis or separate queue.

## What's in this repository

```
apps/
  api/       the HTTP API (Fastify)
  worker/    sends queued emails and delivers webhooks
  web/       the panel (Vue)
  docs/      the API docs site (Scalar)
  site/      the marketing page
packages/
  db/        database schema and migrations (Drizzle)
  providers/ the Amazon SES integration
  templates/ turns templates into HTML and plain-text email (MJML)
  core/      encryption for stored credentials
```

## Learn more

- [How the system is built](docs/architecture.md)
- [What happens to an email, step by step](docs/email-lifecycle.md)
- [The worker](docs/worker.md)
- [Templates](docs/templates.md)
- [Webhooks](docs/webhooks.md)
- [Suppressions](docs/suppressions.md)
- [Deliverability](docs/deliverability.md)
- [Sign-in, organizations, and roles](docs/panel-auth.md)

## Contributing

Run `pnpm typecheck` and `pnpm test` before opening a pull request. Tests that need a database
are skipped unless `DATABASE_URL` is set; see [AGENTS.md](AGENTS.md) for how to run them, plus the
code conventions this project follows.

## License

[AGPL-3.0](LICENSE)
