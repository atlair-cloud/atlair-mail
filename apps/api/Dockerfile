# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json            apps/api/
COPY apps/web/package.json            apps/web/
COPY apps/worker/package.json         apps/worker/
COPY packages/core/package.json       packages/core/
COPY packages/db/package.json         packages/db/
COPY packages/providers/package.json  packages/providers/
COPY packages/templates/package.json  packages/templates/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @atlair-mail/api...

FROM base
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0
COPY --from=deps /app /app
COPY packages packages
COPY apps/api apps/api
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/src/server.ts"]
