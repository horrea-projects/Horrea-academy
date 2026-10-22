# Coolify production image — Next.js standalone, mirrors Nixpacks (pnpm + Node 22).
# Pinned to Node 22.23.4 (2026-10-21 security release) instead of floating node:22-alpine
# or Nixpacks' 22.11.0 (NIXPACKS_NODE_VERSION=22).
FROM node:22.23.4-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Match local/Nixpacks pnpm; lockfileVersion 9
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholders (Coolify injects real values via build args / env).
# NEXT_PUBLIC_* are inlined at build time by Next.js.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_placeholder
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
ARG NEXT_PUBLIC_APP_URL=

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN pnpm run build \
  && mkdir -p /migrate-vendor \
  && cp -aL node_modules/postgres /migrate-vendor/postgres

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration tooling for Coolify pre-deploy / one-off (no Prisma; db/schema.sql + scripts).
# Next standalone traces `postgres` into server chunks, so copy a real (dereferenced)
# package tree for `node scripts/db-migrate.mjs`.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /migrate-vendor/postgres ./node_modules/postgres

USER nextjs
EXPOSE 3000
# Equivalent to Nixpacks `pnpm start` for standalone output
CMD ["node", "server.js"]
