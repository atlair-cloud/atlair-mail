# API docs

`apps/docs` is the Worker behind `docs.atlair.cloud`: a Scalar API reference with a playground, plus a
guide for getting started and setting up Amazon SES.

| Path | Serves |
| --- | --- |
| `/` | The Scalar page, loading Scalar from jsDelivr at a pinned version |
| `/openapi.json` | The API's live spec, cut down to the public API |
| `/proxy` | The playground's requests, forwarded to the API |

## The spec

`/openapi.json` fetches `https://api.atlair.cloud/mail/docs/openapi.json` (cached for five minutes) and keeps
only `/service/web/*`, dropping the root-key `organizations` routes. The panel's
`/service/panel/organizations/{organizationId}/*` routes use a session cookie and an organization ID,
so they never appear: every documented request authenticates with an API key and carries no
organization ID. Paths lose the `/mail` prefix and their trailing slash, and the server becomes
`https://api.atlair.cloud/mail`, so code samples show the real address. The guide in
`src/guide.md` becomes `info.description`, which Scalar shows under Introduction; its IAM policy is
read from the panel's `ses-policy.ts` so the two never differ.

## The playground

The API sends CORS headers only for the panel, so a browser on `docs.atlair.cloud` cannot call it
directly. Scalar's `proxyUrl` sends each request to `/proxy?scalar_url=<target>` instead. The proxy
forwards only to `https://api.atlair.cloud/mail/service/web/*` and answers anything else with 403,
passes on only `accept`, `authorization`, `content-type`, `api-version` and `idempotency-key`, and drops
`set-cookie` from the response.

## Deploy

`pnpm --filter @atlair-mail/docs deploy` runs `wrangler deploy`, which attaches `docs.atlair.cloud` as a
custom domain. The landing site and the panel link here through `VITE_DOCS_URL`; without it they link
to `<VITE_API_URL>/docs/`, which is what self-hosted builds use.
