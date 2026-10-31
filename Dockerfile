# syntax=docker/dockerfile:1

# ---- the node agent, built from source so the image always serves a matching binary ----
# One binary per node architecture, whatever this image runs on: the control plane's own CPU says
# nothing about its nodes'. Pure Go with cgo off, so cross-compiling needs no emulation.
FROM --platform=$BUILDPLATFORM golang:1.23-alpine AS agent
WORKDIR /agent
COPY agent/go.mod agent/go.sum ./
RUN go mod download
COPY agent/*.go ./
RUN for arch in amd64 arm64; do \
      CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags "-s -w" -o /out/cloud-vpn-agent-linux-$arch . \
      && (cd /out && sha256sum cloud-vpn-agent-linux-$arch > cloud-vpn-agent-linux-$arch.sha256) || exit 1; \
    done

# ---- dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` only reads the schema — it never connects — but prisma.config.ts resolves
# the datasource eagerly, so the variable has to exist. These placeholders live only in the
# build stage; the runtime image gets the real values from the env file.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
RUN pnpm exec prisma generate
# NEXT_PUBLIC_* is inlined into the bundle at build time — including into server code — so it
# cannot be supplied at runtime however it is passed. The real key must be baked in here, which
# is safe: a publishable key is public by design. It does make the image environment-specific.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN pnpm exec next build

# ---- runtime ----
FROM node:22-alpine AS runner
RUN corepack enable && apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Served at /install.sh and /download/* — the installer fetches these, so they ship together
# with the app that advertises them.
COPY --from=builder /app/agent/install.sh ./agent/install.sh
COPY --from=builder /app/agent/cloud-vpn-agent.service ./agent/cloud-vpn-agent.service
COPY --from=agent /out/ ./agent/dist/
COPY docker-entrypoint.sh /usr/local/bin/

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "exec", "next", "start"]
