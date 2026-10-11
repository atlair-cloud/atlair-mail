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
  they used, or the organization list. The organization list and every `/organizations/:organizationId`
  page also send a user with no organization to onboarding, so a sign-in that returns to an old link
  (for example an organization that was deleted) still lands on "Create your organization".
- Name and logo come from `src/lib/brand.ts`.

## Pages

| Path | Page |
|---|---|
| `/auth/login` | Continue with GitHub or Google; the first sign-in creates the account |
| `/auth/callback` | OAuth return; verifies the session, then continues |
| `/onboarding`, `/organizations/new` | Create an organization |
| `/organizations` | Pick an organization |
| `/organizations/:organizationId` | Overview |
| `/organizations/:organizationId/emails` | Emails: status filter (`?status=`), newest first, "Load older emails" |
| `/organizations/:organizationId/emails/:emailId` | One email: what happened, content, addresses, IDs |
| `/organizations/:organizationId/templates` | Templates table (search, pages); "New template" opens a starter gallery |
| `/organizations/:organizationId/templates/new?starter=` | Editor with a starter (blank, welcome, password-reset, receipt); nothing is saved until "Create template" |
| `/organizations/:organizationId/templates/:templateId` | Template editor (see below) |
| `/organizations/:organizationId/domains` | Table of domains with status, region and when each was added; add a domain |
| `/organizations/:organizationId/domains/:domainId` | Status, added/region/last checked, DNS records grouped as DKIM, SPF and DMARC, "Check now", remove |
| `/organizations/:organizationId/api-keys` | Active and revoked keys; create (shown once) and revoke |
| `/organizations/:organizationId/webhooks` | Endpoints; add one (signing secret shown once) |
| `/organizations/:organizationId/webhooks/:webhookId` | Deliveries, events, edit, enable/disable, rotate secret, delete |
| `/organizations/:organizationId/suppressions` | Suppressed addresses with reason and source email; look up, add, remove |
| `/organizations/:organizationId/playground` | Compose an email, see the same request as cURL, Node.js or Python, send it with your session and watch its status. Recipient shortcuts include Amazon's simulator addresses, which work in the SES sandbox |
| `/organizations/:organizationId/settings` | General: name, slug (checked live), ID, deactivate (owner) |
| `/organizations/:organizationId/settings/provider` | SES connection, delivery tracking status, switch between pull and push, retry set-aside events, replace credentials, disconnect |
| `/organizations/:organizationId/settings/members` | Add (they must have signed in once), change role, remove or leave |
| `/organizations/:organizationId/settings/audit-log` | Who changed the organization and its members (owners and admins) |

The API reference isn't rebuilt in the panel: "API docs" in the section tabs, the playground and the command menu open the API's own docs site (`{API_URL}/docs/`, `API_DOCS_URL` in `src/lib/links.ts`).

## Overview

Where people land in an organization. It answers "is my email working, and if not, what next?"
from one request, `GET /service/panel/organizations/:id/overview` (`services/overview.ts`).

- **Status line** under the name: "Not sending yet" during setup, "Sending normally" with the last
  24 hours, or the most important problem itself ("4 emails refused: your Amazon SES account is in
  the sandbox") with how many more are listed below.
- **Setup** (`health: "setup"`, until SES is connected, a domain is verified and an email was sent):
  a four-step guide done in place, each step ticked from real data. The open step follows progress.
  1. Connect Amazon SES: region and access key, with the least-privilege IAM policy to copy. Then
     "Turn on tracking" asks how events arrive: "Check a queue" (pull, the default, no public address
     needed) or "Send to this server" (push, with the API's public https address, prefilled from
     `VITE_API_URL` when it is https). Settings → Provider shows the mode, the push address or the next
     pull check, and "Change…" switches mode.
  2. Verify a domain: add it, then copy each DNS record (required and recommended), see which ones
     SES found, and "Check now". Refreshes every 15 seconds while pending.
  3. Create an API key: name and permission; the token is shown once and filled into step 4.
  4. Send your first email: a ready `curl`, or a test send to yourself or to Amazon's simulator
     (works in the SES sandbox). Finishing setup shows a one-time "You're sending" banner.
  Steps 1–3 need an owner or admin; steps unlock in order (a domain needs SES, sending needs a domain).
- **Last 7 days** (`SendingSummary`): the total, "N of M delivered" over finished emails (delivered,
  bounced, complained or failed, so failures count), one outcome bar with a labelled count for
  delivered, failed, bounced or spam, and in flight. A daily chart with counts appears once there are
  3 active days; before that a sentence says when they were sent.
- **Bounce and complaint rates** are shares of emails SES accepted, drawn against SES's review limits
  (5% and 0.1%). Below 50 accepted emails they say "Not enough emails yet" instead of a number, and
  raise no attention items (warning at 2% and 0.05%).
- **Needs attention**: shown only when something is wrong, critical first, each with its fix as a
  button. Failed emails in the last 24 hours are grouped by error code and explained: refused in the
  SES sandbox (links to request production access), recipients suppressed, domain not verified,
  over the sending rate. Also failed or pending domains, delivery events not connected or failing,
  the two rates, SES sending paused, 80% of the daily quota used, and failing webhook endpoints.
- **Recent emails** (10): identical emails in a row collapse into one with ×N, and failed ones show
  a short reason (`shortFailureReason`).
- **Sending domains** and **Sending limits**: sandbox or production, emails sent against the 24-hour
  quota, and the per-second rate, read from SES with `GetAccount` and cached for 5 minutes
  (`providerConnections.account`).
- Refreshes every 5 seconds while a recent email is queued, sending or sent; every 15 seconds while a
  domain waits for DNS; otherwise every minute.
- Links to pages that don't exist yet are left out (`routeIfExists` in `src/lib/links.ts`), so they
  appear as the Domains, API keys, Emails and Settings pages land.

## Navigation

Section tabs sit under the top bar (`layouts/organization/SectionTabs.vue`). A tab shows once its
route exists, and a route marks its tab with `meta.section`. The breadcrumb adds the current item on
detail pages (for example Emails / subject), and ⌘K jumps to sections and common filters.

## Emails

- The list is a `DataTable`: search (subject or recipient), status and date filters live in the URL
  (`?search=&status=&range=`), and pages step with `before`. The first page polls every 5 seconds
  while it has an email queued, sending or sent, and every 30 seconds otherwise; later pages don't.
- The detail page builds "What happened" from the email and its events: queued, scheduled, accepted
  by SES, then delivered, delayed, bounced (soft or permanent, with each recipient's diagnostic),
  complained, opened, clicked, or failed with the worker's error code explained. While waiting it
  shows the next step and polls every 4 seconds. Once an email is `sent` on a pull-mode connection,
  it shows when the worker next reads the queue (`events.nextCheckAt`) and polls every 30 seconds.
- HTML bodies render in an `<iframe sandbox="">` with `srcdoc`, so scripts and forms never run.

## Template editor

`features/templates` is a Notion-style editor on TipTap (`@tiptap/vue-3`, MIT). Its schema mirrors the
server's (`packages/templates`), so anything you can build can be saved; see
[templates.md](templates.md) for the document format.

- **Writing**: `/` opens the block menu (`editor/menus/suggestions.ts`, filtered to blocks allowed at
  the cursor), `{{` inserts or creates a variable, selecting text shows the formatting bubble (⌘B, ⌘I,
  ⌘U, ⌘K for links, alignment). ⌘D duplicates a block, ⌘S saves.
- **Blocks**: button, image, spacer and the variable chip are Vue node views (`editor/nodes`); columns
  and sections are plain nodes. The ⋮⋮ handle (`BlockHandle.vue`) is ours, not TipTap's drag-handle
  extension, which pulls in the Yjs collaboration packages: it drags with ProseMirror's own
  `view.dragging`, and clicking it opens Turn into, Duplicate and Delete.
- **What you see is the email**: the canvas uses the template's own colors, font and width with fixed
  hex values, so it doesn't change with the panel's dark mode. Desktop/Phone switches the canvas to
  375px and stacks columns; the same choice carries into Preview.
- **Sidebar**: Block (settings for the selected block, or its section and columns), Style (theme) and
  Variables (type, fallback, sample value, usage count; undeclared ones are declared as required text
  on save).
- **Preview** renders through `POST /templates/preview` in a sandboxed iframe, with HTML or text and
  desktop or phone. Unfinished blocks (a button without a link, an image without an address) are
  stand-ins in preview, and saving lists them in plain words instead of sending a request that would
  fail.
- **Saving** sends the loaded `revision`; a 409 shows "Load their version" or "Save mine over it".
- **Publishing**: Save writes the draft; Publish (saving first if needed) opens `PublishModal`, which
  lists what changed since the live version and toggles a live/new preview. The status chip
  (`ReleaseStatus`) opens `VersionHistory`, a slideover to preview, restore or roll back versions;
  `?history=<n>` opens it on version n (the email page links there). Send test sends the draft.
- `EmailFrame` renders sent or previewed HTML in a sandboxed iframe, scaled down only when the frame
  is narrower than 640px.
  Leaving with unsaved changes asks first. Members get a read-only editor.

## Patterns

Every panel endpoint has a page. They share a few patterns so moving between them feels the same:

- **Page header** (`components/shared/PageHeader.vue`): eyebrow, title, one sentence on what the
  page is for, and the primary action on the right. The primary action is hidden until there is
  something to manage; the empty state carries it instead.
- **States**: skeleton while loading, `LoadErrorCard` with "Try again" on failure, `EmptyState`
  that says what will appear and how to start, `NotFound` for unknown IDs.
- **Tables** (`components/data-table`): `DataTable` takes `columns` and `rows` and renders each
  cell from a `#cell-<key>` slot, with the toolbar, skeleton rows, empty state and footer inside one
  frame. `rowTo` makes the whole row a link. `TableSearch` debounces into the URL, `TableFilter` is
  a dropdown with an "any" choice and status dots, and `TablePagination` with `useCursorPages`
  steps through cursor pages (`before`/`hasMore`), resetting when a filter changes.
- **Modals** put the content on the white card and the choices on the frame below: Cancel on the left,
  the action on the right (`ModalActions`). Forms used in a modal take `in-modal` and a `form-id`, and
  the footer button submits them with `form=`.
- **Controls**: `AtlairSwitch` for on/off choices (webhook events, API key full access), `ChoiceCards` for picking one
  of several options (rotation overlap). No native checkboxes or radios; corners follow the
  0.25rem Atlair radius, never pills.
- **Create flows** open a `FramedModal`. Anything shown once (API keys, signing secrets) is revealed
  in the same modal with `SecretReveal`, and the modal can't be dismissed by clicking outside until
  it's acknowledged. Creating a domain or webhook then opens its page.
- **Destructive actions** sit in a red `SettingsCard` at the bottom and confirm with `ConfirmModal`;
  irreversible, wide-reaching ones (removing a domain, deactivating, disconnecting) ask you to type
  a confirmation.
- **Feedback**: small changes show a Nuxt UI toast; after a mutation every query under
  `['organizations', id]` is invalidated, so the overview, tabs and lists agree.
- **Who and when**: every list shows when each item was created and by whom with `AuditStamp`
  (the member's initials or a key icon and the API key's name, over a relative time; hover for the
  exact one), plus an Updated column for things that change (domains, webhooks). Detail pages show
  created and updated, each with its author, in a `FactsRow` built with `authorshipFacts()`. Emails
  show who sent them (a member from the panel or an API key); their later changes are automatic.
  Members show who added them and who last changed their role; General settings shows who created
  and last renamed the organization. No author means Atlair Mail did it, or the member or key is gone.
- **Roles**: owners and admins see write actions; members get read-only pages with a note saying
  who can act. Only owners see "Deactivate"; the audit log is for owners and admins.
- Onboarding reuses the same components (`ConnectSesForm`, `DeliveryTrackingCard`, `AddDomainForm`,
  `DomainVerification`, `CreateApiKeyForm`), so a step looks the same as its page.
