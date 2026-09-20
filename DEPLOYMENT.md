# Deploying the control plane

One host, Docker Compose, Caddy in front for TLS. The image also builds and serves the node
agent, so a node enrolled from this control plane always gets a matching binary.

## Prerequisites

- **DNS**: `vpn.zoiee.me` → the control plane's Elastic IP (`52.77.111.2`).
- **Security group**: inbound `80` and `443` from anywhere (Caddy needs 80 for the ACME
  challenge), `22` from your IP only.
- **Docker + compose plugin** on the host.

## First deploy

```bash
ssh ubuntu@52.77.111.2
sudo install -d -m 0750 -o ubuntu -g ubuntu /opt/cloud-vpn
```

Clone (or copy) the repo to `/opt/cloud-vpn`, then write `/opt/cloud-vpn/.env`:

```bash
DATABASE_URL='postgresql://…-pooler.…neon.tech/neondb?sslmode=verify-full&channel_binding=require'
DIRECT_URL='postgresql://…neon.tech/neondb?sslmode=verify-full&channel_binding=require'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
CLERK_SECRET_KEY=sk_live_…
APP_ENCRYPTION_KEY=…
APP_DOMAIN=vpn.zoiee.me
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
`ghcr.io/ritik3236/cloud-vpn:latest` and a SHA-tagged image. Then on the host:

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

- **Lock each node's agent port to this host.** On every node, allow `51821/tcp` only from
  `52.77.111.2`. TLS and the bearer token already protect it; this removes it from the public
  internet entirely.
- **Check `/install.sh` serves**: `curl -fsS https://vpn.zoiee.me/install.sh | head -1`.
- **Rotate the Clerk secret and the Neon role password** if they have ever been pasted anywhere
  they should not persist.

## Checks

```bash
docker compose ps
docker compose logs -f app
pnpm node:status      # every node, whether its agent answers, whether its key still matches
```
