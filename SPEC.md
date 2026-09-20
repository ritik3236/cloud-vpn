# Cloud VPN — Architecture Spec

A central control plane that manages a fleet of VPN nodes and hands out WireGuard
configs to managed clients, with role-based staff access and a self-service user
dashboard. Replaces the current friction of logging into each node's own
dashboard on its own domain.

Status: **draft blueprint** (decisions locked 2026-09-20; see Open Questions for the few left).

---

## 1. Goals & non-goals

**Goals**
- One place for staff to issue, view, and revoke configs across **all** nodes.
- Configs from two kinds of source, behind one "issue config" action:
  - **Managed** self-hosted nodes → generate + provision + revoke automatically.
  - **External** providers (Proton) → store an admin-supplied `.conf` and assign it.
- Self-service **user dashboard**: a client logs in once, sees their own configs, downloads / QR, nothing else.
- Role-based staff: **admin** (full), **ops** (read + block, no create).
- Scale target: **~1000 users**, single organization, onboarded by staff (no public signup).

**Non-goals (for now)**
- Public self-signup / billing (users are managed by hand).
- Multi-tenant (many customer orgs). Single org only.
- Mesh / zero-trust site networking (this is exit-VPN + resource access, not a Tailscale-style mesh).
- Programmatic control of Proton (impossible — Proton has no admin API; see §6).

---

## 2. Roles (RBAC)

| Capability | admin | ops | user |
|---|---|---|---|
| View all users / configs / nodes | ✅ | ✅ | own only |
| Generate & assign a config | ✅ | ❌ | ❌ |
| Block / revoke a config | ✅ | ✅ | ❌ |
| Onboard / remove users | ✅ | ❌ | ❌ |
| Upload external (Proton) configs | ✅ | ❌ | ❌ |
| Add / remove nodes | ✅ | ❌ | ❌ |
| Download own config / QR | — | — | ✅ |
| Manage staff accounts | ✅ | ❌ | ❌ |

- **admin** (currently 2 people) = everything.
- **ops** = monitor + emergency kill switch; cannot create anything.
- **user** = own dashboard only.
- A separate **superadmin** tier is optional; with 2 admins it's not needed at launch (Open Q).

Roles are carried in Clerk (org roles / public metadata) and enforced server-side on every API call — never trust the client.

---

## 3. Architecture

```
                 ┌──────────────────────────────────────────┐
   admin/ops ──► │  Control plane (one domain)               │
   users     ──► │  Next.js app + API   ·  Clerk auth (RBAC) │
                 │  Postgres = Neon                          │
                 └───────────────┬──────────────────────────┘
                      ┌──────────┴───────────┐
               managed driver           static driver
            (HTTPS → node agent)        (encrypted vault in DB)
             ┌────────┴────────┐          ┌────┴────┐
         node agent        node agent   Proton     other
         (Go) + wg         (Go) + wg    .conf      .conf
         any provider      any provider  uploaded, assigned
```

**Components**
- **Control plane** — Next.js (dashboards + API), self-hosted in Docker. Single source of truth for users, nodes, and config records.
- **Node agent** — a small Go binary on each managed node. Exposes an authenticated API the control plane calls to add/remove/list WireGuard peers and report status. The node runs `wg`; the agent never does anything shell-shaped beyond peer management.
- **External vault** — encrypted storage (in Neon) for admin-uploaded `.conf` files (Proton etc.), assigned to users.
- **Clerk** — auth + RBAC (cloud).
- **Neon** — Postgres (cloud).

Everything except **Clerk** and **Neon** is self-hosted and Dockerized.

---

## 4. Tech stack

| Layer | Choice | Hosting |
|---|---|---|
| Control plane (UI + API) | Next.js (React, TypeScript) | self-hosted Docker (droplet) |
| ORM / migrations | Prisma | — |
| DB | Neon Postgres | cloud |
| Auth + RBAC | Clerk | cloud |
| Node agent | Go (single static binary, no runtime deps) | self-hosted, one per node |
| External vault | app + Neon (encrypted at rest) | self-hosted |
| Container/orchestration | Docker Compose | self-hosted |

Rationale: self-hosted control plane matches the org's privacy posture and holds the crown-jewel secrets; Clerk+Neon are the two deliberate cloud dependencies for speed. Go agent = drop-on-any-VPS with zero deps.

---

## 5. WireGuard provisioning model (managed nodes)

WireGuard's design is what makes central control clean: **the server never needs the
client's private key.** Issuing a managed config:

1. Control plane generates a client keypair (Curve25519 — pure crypto, no node call).
2. Allocates a free IP from that node's pool (IPAM, §8).
3. Calls the node agent: `add-peer(pubkey, allowed_ip)`.
4. Builds the client `.conf`: client private key + node public key + node endpoint + DNS + `AllowedIPs`.
5. Stores the config **record** (user, node, pubkey, IP, status, issued_by). The private
   key is shown to the user **once** (or generated client-side; see Open Q), not stored in plaintext long-term.

**Revoke** = agent `remove-peer(pubkey)` + mark the record `blocked`. Instant, per-config.

**Default tunnel mode:** full-tunnel exit (`AllowedIPs = 0.0.0.0/0`) — matches all current
usage (Proton-style exit VPN). Split/resource-access is a per-config option later (Open Q).

**Per-device:** WireGuard cannot share one key across two devices (same key on two devices
causes handshake flapping — observed in the webtop build). So **each device = its own
config/peer.** A user with a phone + laptop has two configs. The data model reflects this.

---

## 6. External configs (Proton & other) — static driver

Proton is a consumer VPN with **no admin API**: you cannot programmatically create or
revoke a user's Proton tunnel. So in this platform:

- Admin **pastes / uploads** a Proton `.conf` into the vault (stored encrypted).
- Admin **assigns** it to a user; it appears in the user's dashboard like any other config.
- "Revoke" for a static config = un-assign / hide it (the tunnel still exists on Proton's
  side until the admin removes the device in Proton's own account — out of our control).

Same "issue config" UX as managed; different engine. This is the one capability that is
storage-only, by nature of the provider.

---

## 7. Node agent — protocol

A minimal authenticated HTTP(S) service on each node. The control plane is the only caller.

| Endpoint | Purpose |
|---|---|
| `POST /peers` `{pubkey, allowed_ip}` | add a peer (`wg set`) |
| `DELETE /peers/{pubkey}` | remove a peer |
| `GET /peers` | list peers + last-handshake / transfer (for status) |
| `GET /health` | liveness + node pubkey + wg status |

- **Auth:** bearer token per node (stored in the DB, per node). mTLS optional hardening later.
- **Least privilege:** the agent only manages peers; it does not accept arbitrary commands.
- **Idempotent:** re-adding an existing peer is a no-op; removing a missing one succeeds.
- **Reachability:** control plane → agent over the node's public IP + agent port (TLS). Nodes
  behind NAT would need an outbound-connecting agent (not needed for public VPS).

---

## 8. Data model (core tables)

- **users** — id, name, email (Clerk-linked), status(active/suspended), created_at
- **staff** — id, clerk_id, role(admin|ops), created_at  *(or role held entirely in Clerk metadata)*
- **nodes** — id, name, region, provider, endpoint(host:port), node_pubkey, cidr_pool, dns,
  agent_url, agent_token(encrypted), status, driver=`managed`
- **external_sources** — id, name(e.g. "Proton"), driver=`static`
- **ip_allocations** — node_id, ip, config_id  *(IPAM: which IPs are taken per node)*
- **configs** — id, user_id, device_label, source_type(`managed`|`static`), node_id?,
  pubkey?, assigned_ip?, encrypted_conf?(static), allowed_ips, status(active|blocked),
  issued_by, created_at, revoked_at
- **audit_log** — id, actor(staff/clerk_id), action, target, timestamp, detail

Notes:
- managed config → `pubkey`+`assigned_ip`+`node_id`; static config → `encrypted_conf`.
- a user has **many** configs (per device, per node).
- IPAM lives in `ip_allocations` so the control plane never double-assigns an IP.

---

## 9. Security model

The control plane becomes the **highest-value target** — if breached, every node's peers
and the client list are exposed; if down, no new configs issue.

- Staff access: Clerk + **MFA required**; RBAC enforced server-side on every route.
- Secrets at rest (Neon): encrypt `agent_token`, `encrypted_conf`, and any stored private
  keys with an app-held key (not just DB-level). Generated client keys shown **once**.
- Node agents: per-node bearer token (rotate-able); agent bound to control-plane origin;
  peer-management-only surface.
- Full **audit log** — who issued / blocked / logged in, when.
- Backups: Neon PITR for data; each node's `wg` state is reproducible from the DB (the DB is
  the source of truth for peers, so a rebuilt node re-provisions from records).
- Node prerequisite (learned constraint): kernel WireGuard + `NET_ADMIN` + `ip_forward` +
  `src_valid_mark`. **KVM VPS = safe; some LXC providers block these sysctls** (hit on the
  njal.la LXC) — verify before adding an LXC node.

---

## 10. Node onboarding (target flow)

Adding a node on **any** provider becomes:
1. Spin up a VPS (KVM preferred; LXC → verify sysctls).
2. Install WireGuard + drop the Go agent (one binary + a systemd unit or container).
3. Open UDP (wg port) publicly + agent port to the control plane.
4. In the dashboard: **Add node** → name, region, endpoint, CIDR pool, DNS, agent URL+token.
5. Node is now a selectable "location" admins can issue configs for.

No per-node dashboard, no per-domain login — that friction is gone.

---

## 11. Phased build plan

**Phase 1 — MVP (managed only)** — the friction-killer:
- Clerk auth + RBAC (admin/ops/user), Neon schema (Prisma)
- Node registry + the Go agent (`add`/`remove`/`list`/`health`)
- Issue / assign / revoke a self-hosted config (full IPAM)
- User dashboard: list own configs, download + QR
- Audit log

**Phase 2 — external vault:**
- Paste/upload Proton `.conf`, encrypt, assign, surface in user dashboard

**Phase 3 — polish:**
- ops-role hardening, connection status (last handshake from agent), per-config expiry,
  bulk onboarding, node health monitoring, backup/restore runbook

---

## 12. Constraints & lessons carried in (from the webtop/escrow work)

- **Proton can't be auto-provisioned** — static vault only (§6).
- **One WireGuard key per device** — same key on two devices flaps; per-device configs (§5).
- **LXC sysctl trap** — `src_valid_mark` / `ip_forward` may be blocked on container VPS;
  KVM is safe, LXC needs verifying before use as a node (§9).
- **Full-tunnel routing on a box that also serves inbound** — split routes (`0.0.0.0/1`
  + `128.0.0.0/1`) avoid the fwmark sysctl issue if `wg-quick` ever runs on a restricted host.

---

## 13. Open questions / assumptions to confirm

Assumptions baked into this draft (flag if wrong):
1. **VPN type = full-tunnel exit** (route all user traffic out the node). *Confirm vs.
   resource/site-access, which changes AllowedIPs + possibly ACLs.*
2. **Per-device configs** — a user may hold several (phone, laptop), each its own peer.
3. **No expiry at MVP** — configs live until revoked (expiry is a Phase-3 field).
4. **No separate superadmin** — 2 admins share full power.

Still to decide:
- Client private key generated **server-side (shown once)** or **in the browser** (server
  never sees it — stronger, slightly more UI work)?
- Control-plane domain (highbytestech.com subdomain? new domain?).
- How users first receive access — Clerk invite email → set password → dashboard.

---

## 14. What's cloud vs self-hosted (explicit)

| Self-hosted (Docker, yours) | Cloud (deliberate deps) |
|---|---|
| Control-plane app + API | Clerk (auth + user identities) |
| Node agents + WireGuard | Neon (Postgres) |
| External config vault (encrypted) | |
| VPN nodes (any provider) | |
