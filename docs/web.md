# Web app (`apps/web`)

The panel UI: a Vue 3 single-page app that talks to `/service/panel` and Better Auth (`/api/auth`) on
the API. It ships as static files (`apps/web/build`) and can be served from any static host.

The design system (styles, layouts, shared components) is copied from atlair-ui, so it shares
Atlair's look: Nuxt UI on Tailwind 4, Spline Sans, the navy `atlair-*` palette, light and dark
themes, and the framed shell with a flickering-grid backdrop.

## Run it

```bash
docker compose up -d --wait
cp apps/api/.env.example apps/api/.env      # set BETTER_AUTH_SECRET (openssl rand -base64 32) and GitHub/Google OAuth credentials
pnpm --filter @atlair-mail/api dev           # http://localhost:8080
pnpm --filter @atlair-mail/web dev           # http://localhost:5173
```

`PANEL_ORIGINS` on the API must contain the web app's origin (`http://localhost:5173` in dev).

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | API origin. Must be same-site with the web app so the session cookie is sent. |
| `VITE_AUTH_SOCIAL_PROVIDERS` | `github,google` | Which sign-in buttons to show; match the providers configured on the API. |
| `BUILD_SHA` | `local` | Shown in crash details. |

Vite reads these at build time; set them when running `pnpm --filter @atlair-mail/web build`.

## Layout

```
src/
  app/          bootstrap, query client, theme, failure handling, view transitions, route prefetch
  styles/       Tailwind and Nuxt UI theme, dark theme, frame, loading and transition CSS
  components/shared/   status screens, modals, empty state, skeletons, error boundary
  layouts/      ShellLayout (top bar, framed panel) and OrganizationLayout (current organization)
  router/       routes and the session guard
  lib/          API client, error descriptions, formatting, brand
  features/<domain>/   pages, components, composables and API calls for one domain
```

- Server state lives in TanStack Vue Query; Pinia only keeps client state (the last organization).
- API calls go through `apiFetch` (`src/lib/api/client.ts`), which prefixes `/service/panel`, sends
  `Api-Version: 1` and the session cookie, and throws `ApiError` with the HTTP status.
- Routes opt into auth with `meta.requiresAuth`; sign-in pages use `meta.guestOnly`.
- `/` sends a signed-in user to onboarding (no organization), their only organization, the last one
  they used, or the organization list.
- Name and logo come from `src/lib/brand.ts`.

## Pages

| Path | Page |
|---|---|
| `/auth/login` | Continue with GitHub or Google; the first sign-in creates the account |
| `/auth/callback` | OAuth return; verifies the session, then continues |
| `/onboarding`, `/organizations/new` | Create an organization |
| `/organizations` | Pick an organization |
| `/organizations/:organizationId` | Overview |

## Overview

Where people land in an organization. It answers "is my email working, and if not, what next?"
from one request, `GET /service/panel/organizations/:id/overview` (`services/overview.ts`).

- **Status line** under the name: "Not sending yet", "Sending normally", "Sending, N things to
  check" or "Needs attention now", from the response's `health`.
- **Setup** (`health: "setup"`, until SES is connected, a domain is verified and an email was sent):
  a four-step guide done in place, each step ticked from real data. The open step follows progress.
  1. Connect Amazon SES: region and access key, with the least-privilege IAM policy to copy. Then
     "Turn on tracking" sets up delivery events in pull mode (no public address needed).
  2. Verify a domain: add it, then copy each DNS record (required and recommended), see which ones
     SES found, and "Check now". Refreshes every 15 seconds while pending.
  3. Create an API key: name and permission; the token is shown once and filled into step 4.
  4. Send your first email: a ready `curl`, or a test send to yourself or to Amazon's simulator
     (works in the SES sandbox). Finishing setup shows a one-time "You're sending" banner.
  Steps 1–3 need an owner or admin; steps unlock in order (a domain needs SES, sending needs a domain).
- **Sending**: emails over 7 UTC days, delivered rate, and bounce and complaint rates drawn against
  Amazon SES's review limits (5% and 0.1%). Rates count only emails SES accepted, and raise attention
  items only from 50 accepted emails, so one early bounce isn't an alarm (warning at 2% and 0.05%).
- **Needs attention**: shown only when something is wrong, critical first. Failed or pending domains,
  delivery events not connected or failing, the two rates, failed emails in 24 hours, and webhook
  endpoints with failed or retrying deliveries in 24 hours.
- **Recent emails** (10) and **sending domains**, plus counts of keys, webhooks, suppressions and members.
- Refreshes every 5 seconds while a recent email is queued, sending or sent; every 15 seconds while a
  domain waits for DNS; otherwise every minute.
- Links to pages that don't exist yet are left out (`routeIfExists` in `src/lib/links.ts`), so they
  appear as the Domains, API keys, Emails and Settings pages land.

Next: section tabs, then domains and provider, API keys, emails, webhooks and suppressions, and
organization settings (members, roles, audit log).
