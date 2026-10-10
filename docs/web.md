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

Next: domains, API keys and provider, emails, webhooks and suppressions, and organization settings
(members, roles, audit log).
