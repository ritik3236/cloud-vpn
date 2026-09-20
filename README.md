# Cloud VPN — control plane

Central control plane for a fleet of WireGuard nodes: issues, assigns and revokes client configs
across every node from one dashboard, with role-based staff access and a self-service user view.

**[SPEC.md](SPEC.md) is the authority** for roles (§2), the config lifecycle (§5), the node-agent
protocol (§7), the data model (§8) and the security model (§9). Build rules are in
[CLAUDE.md](CLAUDE.md).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, RSC-first), React 19, TypeScript |
| Styling | Tailwind v4 |
| DB | Neon Postgres via Prisma 7 + `@prisma/adapter-pg` |
| Auth | Clerk (admin / ops / user, enforced server-side) |
| Node agent | Go binary, one per node — not in this directory yet |

## Layout

```
prisma/schema.prisma   data model (SPEC §8)
prisma.config.ts       migrations connect over DIRECT_URL (unpooled)
src/
  app/                 routes (thin)
  proxy.ts             Clerk gate — Next 16 renamed middleware → proxy
  api/                 node-agent contracts (SPEC §7), zod request + response
  server/              prisma client, AES-256-GCM crypto, audit log
  auth/                Clerk role helpers
  features/            per-domain UI + actions
  design-system/       the only UI import surface
  lib/                 env validation, helpers
```

Dependencies point inward only; ESLint enforces the fences.

## Local setup

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and fill it in. Two things that will bite:

- **`DATABASE_URL` is pooled, `DIRECT_URL` is not.** Prisma Migrate fails through Neon's pooler.
  `DIRECT_URL` is the same string without `-pooler`.
- **Clerk has two instances.** Local dev uses the `pk_test_` development instance; the `pk_live_`
  instance is bound to `clerk.vpn.zoiee.me` and belongs to the deployed app only.

`APP_ENCRYPTION_KEY` is 32 random bytes, base64 — it encrypts every client private key, static
`.conf` and node agent token. It must never live in Neon (SPEC §9):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

## Migrations

Never against the production branch — create a Neon dev branch first. Additive migrations are
migrate-then-deploy; see `~/dev-notes/db-migrations-playbook.md`.

```bash
pnpm exec prisma migrate dev
```

The IPAM no-double-assign guarantee is a **partial unique index** on `ip_allocations (node_id, ip)
WHERE released_at IS NULL`, which Prisma cannot express in the schema — it is added as raw SQL in
the migration, so do not drop it when editing migrations by hand.
