# Deploying the control plane

> **Since 2026-10-31 the control plane runs in `us-east-1` on a `t4g.small` (arm64) at `3.81.204.180`.**
> The original Singapore box was deleted; nothing was lost because the state is in Neon and Clerk.
> Production data is on the Neon branch endpoint **`ep-dry-cloud-az0dyuss`** (not `ep-wandering-dawn`).
> The published GHCR image is amd64-only, so the arm64 box takes an image **built on the owner's Mac**
> and shipped over SSH; there is no registry in the loop. The box-side files live in `deploy/`.

## Current path (arm64 box, no registry)

```bash
# 1. secrets live in Parameter Store (us-east-1, /cloud-vpn/*); the instance role may read them
# 2. build for arm64 on the Mac, the Clerk publishable key comes from Parameter Store
pk=$(aws ssm get-parameter --region us-east-1 --name /cloud-vpn/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --with-decryption --query Parameter.Value --output text)
docker buildx build --platform linux/arm64 --provenance=false --sbom=false --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$pk" -t cloud-vpn:local --load .
# 3. ship it and the box files, then (re)start: box-deploy.sh writes .env from Parameter Store
docker save cloud-vpn:local | gzip -1 | ssh ubuntu@3.81.204.180 'gunzip | docker load'
scp deploy/box-compose.yml ubuntu@3.81.204.180:/opt/cloud-vpn/docker-compose.yml
scp deploy/box-deploy.sh Caddyfile ubuntu@3.81.204.180:/opt/cloud-vpn/
ssh ubuntu@3.81.204.180 /opt/cloud-vpn/box-deploy.sh
```

`deploy/box-compose.yml` differs from the repo's `docker-compose.yml` in two ways that matter: it runs the
locally loaded `cloud-vpn:local` image, and it gives the app `NODE_OPTIONS=--dns-result-order=ipv4first`
**and** `sysctls: net.ipv6.conf.all.disable_ipv6=1`. The box has no IPv6 route while Neon resolves to an
IPv6 address first; without both settings Prisma reports `P1001 Can't reach database server` (its engine
does not honour the Node option alone). The same P1001 also hides a wrong password, so when it appears,
test the connection string with a plain `pg` client before blaming the network.

The sections below describe the original x86 path (GHCR image, Singapore); they still apply to any
amd64 host.


One host, Docker Compose, Caddy in front for TLS. The image also builds and serves the node
agent, so a node enrolled from this control plane always gets a matching binary.

## Prerequisites

- **DNS**: `tech.bizdaddy.ae` → the control plane's Elastic IP (`3.81.204.180`).
- **Security group**: inbound `80` and `443` from anywhere (Caddy needs 80 for the ACME
  challenge), `22` from your IP only.
- **Docker + compose plugin** on the host.

## First deploy

```bash
ssh ubuntu@3.81.204.180
sudo install -d -m 0750 -o ubuntu -g ubuntu /opt/cloud-vpn
```

Clone (or copy) the repo to `/opt/cloud-vpn`, then write `/opt/cloud-vpn/.env`:

```bash
DATABASE_URL='postgresql://…-pooler.…neon.tech/neondb?sslmode=verify-full&channel_binding=require'
DIRECT_URL='postgresql://…neon.tech/neondb?sslmode=verify-full&channel_binding=require'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
CLERK_SECRET_KEY=sk_live_…
APP_ENCRYPTION_KEY=…
APP_DOMAIN=tech.bizdaddy.ae
```

```bash
chmod 600 /opt/cloud-vpn/.env
cd /opt/cloud-vpn
docker login ghcr.io -u ritik3236        # a PAT with read:packages only
docker compose pull && docker compose up -d
```

`docker compose up -d --build` also works and builds on the host — useful if the registry is
unreachable, but slower and it competes with the running app for memory.

**`DATABASE_URL` and `DIRECT_URL` must point at the branch you intend to run**, not the dev
branch. The entrypoint runs `prisma migrate deploy` before the server accepts traffic, so a
pending migration stops the boot instead of letting a half-migrated app serve requests.

`APP_ENCRYPTION_KEY` must be the **same value** the data was encrypted with. Change it and every
stored private key, agent token and external config becomes undecryptable — there is no recovery.

## Updating

Pushing to `main` runs CI (typecheck, lint, build) and, if that passes, publishes
`ghcr.io/ritik3236/cloud-vpn:latest` and a SHA-tagged image.

The image job needs the repository variable `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Settings →
Secrets and variables → Actions → Variables) set to the `pk_live_` key of the Clerk instance the
image serves — it is inlined into the bundle, so one image serves exactly one Clerk instance. CI
fails rather than publishing an image without it. A publishable key is not a secret; it ships in
the browser bundle either way. Then on the host:

```bash
cd /opt/cloud-vpn && docker compose pull && docker compose up -d
```

Migrations apply on start. The agent binary is rebuilt from source inside the same image, so
`/download/cloud-vpn-agent` and its checksum always match the running control plane — there is
no way to deploy an app and a stale agent.

To roll back, pin the previous SHA:

```bash
docker compose pull ghcr.io/ritik3236/cloud-vpn:<sha> && docker compose up -d
```

## After the first deploy

- **Lock each node's agent port to this host — over IPv6 too.** On every node, allow `51821/tcp`
  only from `3.81.204.180` (plus loopback and the node's own IP, which the installer's readiness
  check uses), and drop it on IPv6. The agent binds dual-stack, so an IPv4-only rule leaves the
  port open to the whole IPv6 internet on any node that has an address there. TLS and the bearer
  token already protect it; this removes it from the public internet entirely. Persist only the
  INPUT rules — wg-quick re-adds its own FORWARD and NAT rules at boot.
- **Check `/install.sh` serves**: `curl -fsS https://tech.bizdaddy.ae/install.sh | head -1`.
- **Rotate the Clerk secret and the Neon role password** if they have ever been pasted anywhere
  they should not persist.

## Changing the control-plane domain

The app barely knows its own hostname — `APP_DOMAIN` drives Caddy, which fetches its own
certificate. **Clerk is the part with teeth**: it requires its Frontend API to be a subdomain of
the app's domain, so the instance must move with the app, and moving it mints a new publishable
key. That key is inlined into the bundle at build time, so this is a rebuild, not a config edit.

Order matters — do it in this sequence to keep the dark window short:

1. **DNS**: `A tech.bizdaddy.ae → 3.81.204.180`. Confirm it resolves before going further.
2. **Clerk**: Dashboard → Domains → change the production domain, then add the CNAME records it
   prints (under `bizdaddy.ae`). Propagation can take hours; Clerk warns up to 48.
3. **New key**: copy the regenerated `pk_live_…` into the GitHub repository variable
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` **and** `/opt/cloud-vpn/.env`, and set
   `APP_DOMAIN=tech.bizdaddy.ae` there too.
4. **Rebuild**: push (or re-run CI) so the image carries the new key, then
   `docker compose pull && docker compose up -d` on the host.
5. **Keep the old name alive**: add a redirect block to the Caddyfile so `tech.bizdaddy.ae` sends
   traffic to the new host instead of dying.

Everyone is signed out by the switch — sessions belong to the old Clerk domain. Nodes are
unaffected: the control plane calls them, never the reverse, and `51821` is locked to the Elastic
IP, which does not change.

## Checks

```bash
docker compose ps
docker compose logs -f app
pnpm node:status      # every node, whether its agent answers, whether its key still matches
```
