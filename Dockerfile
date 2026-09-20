# syntax=docker/dockerfile:1

# ---- the node agent, built from source so the image always serves a matching binary ----
FROM golang:1.23-alpine AS agent
WORKDIR /agent
COPY agent/go.mod agent/go.sum ./
RUN go mod download
COPY agent/*.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/cloud-vpn-agent . \
 && cd /out && sha256sum cloud-vpn-agent > cloud-vpn-agent.sha256

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
# Clerk needs a publishable key at build time; the real one arrives via env at runtime.
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_build-placeholder
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
COPY --from=agent /out/cloud-vpn-agent ./agent/dist/cloud-vpn-agent
COPY --from=agent /out/cloud-vpn-agent.sha256 ./agent/dist/cloud-vpn-agent.sha256
COPY docker-entrypoint.sh /usr/local/bin/

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "exec", "next", "start"]
