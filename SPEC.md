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
- Role-based staff: **admin** (full), **ops** (read + disable/revoke, no create, no key access).
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
| View config **metadata** (all users / configs / nodes) | ✅ | ✅ | own only |
| **Retrieve any user's key / `.conf`** | ✅ | ❌ | ❌ |
| Generate a config (unassigned spare) | ✅ | ❌ | ❌ |
| Assign / unassign a config | ✅ | ❌ | ❌ |
| Disable / re-enable a config (kill switch) | ✅ | ✅ | ❌ |
| Revoke a config permanently | ✅ | ✅ | ❌ |
| Reassign a config to another user | ✅ | ❌ | ❌ |
| Onboard / remove users | ✅ | ❌ | ❌ |
| Upload external (Proton) configs | ✅ | ❌ | ❌ |
| Add / remove nodes | ✅ | ❌ | ❌ |
| Download own config / QR | — | — | ✅ |
| Manage staff accounts | ✅ | ❌ | ❌ |

- **admin** (currently 2 people) = everything.
- **ops** = monitor + emergency kill switch (disable / revoke); cannot create anything, and
  **cannot retrieve key material** — holding a client's private key is equivalent to holding
  the tunnel, which is a create-level power.
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
| Control plane (UI + API) | Next.js (React, TypeScript) | self-hosted Docker on **AWS EC2** (`ap-southeast-1`, co-located with Neon) |
| ORM / migrations | Prisma | — |
| DB | Neon Postgres | cloud |
| Auth + RBAC | Clerk | cloud |
| Node agent | Go (single static binary, no runtime deps) | self-hosted, one per node — **bundled-transfer VPS, never metered-egress cloud** (§12) |
| External vault | app + Neon (encrypted at rest) | self-hosted |
| Container/orchestration | Docker Compose | self-hosted |

Rationale: self-hosted control plane matches the org's privacy posture and holds the crown-jewel
secrets; Clerk+Neon are the two deliberate cloud dependencies for speed. Go agent =
drop-on-any-VPS with zero deps.

The control plane sits on EC2 in the same region as the Neon project, which keeps DB latency
around 1 ms and opens the option of PrivateLink so database traffic never crosses the public
internet. Nodes deliberately do **not** live on the same class of host — see §12.

---

## 5. WireGuard provisioning model (managed nodes)

WireGuard's design is what makes central control clean: **a node only ever needs the client's
public key**, so peers are added centrally without ever touching the client device. (Our control
plane does hold the private key — by choice, for admin retrievability (§9), not because the
protocol requires it.) Issuing a managed config is **two independent steps** — an admin can
mint spares on a node now and hand them out later (decided 2026-09-20, §13).

**Generate** — no user, no node call:
1. Control plane generates a client keypair (Curve25519 — pure crypto, no node call).
2. Reserves a free IP from that node's pool (IPAM, §8).
3. Stores the config **record** (node, pubkey, IP, `unassigned`, issued_by) plus the client
   private key **encrypted at rest** (§13). Keys are generated server-side and stay
   **retrievable by an admin at any time** — the `.conf` is rebuilt on demand from
   `encrypted_privkey` + the node's pubkey / endpoint / DNS, so only one secret per config is
   stored, never a file blob.

**Assign** — to a user; this is what makes it live:
4. Calls the node agent: `add-peer(pubkey, allowed_ip)`.
5. Sets `user_id` + `status = active`. It appears in that user's dashboard, and the `.conf`
   (client private key + node pubkey + endpoint + DNS + `AllowedIPs`) starts working.

An `unassigned` config creates **zero node state** — nothing is connectable until it is
assigned, so every live tunnel maps to a named user in the audit log. The trade-off: assignment
needs the node agent reachable, so if a node is down assignment fails loudly rather than
quietly handing out a dead config.

**Config lifecycle** (managed). All are instant and per-config:

| Operation | Node (`wg`) | Record | IP | User's existing `.conf` |
|---|---|---|---|---|
| **Generate** (spare, no user) | *nothing* | `unassigned` | reserved | n/a — not live yet |
| **Assign** to a user | `add-peer` | `active` | unchanged | starts working |
| **Unassign** (never-delivered spare) | `remove-peer` | back to `unassigned` | unchanged | — |
| **Disable** (reversible kill switch) | `remove-peer` | `disabled` | held, still reserved | stops working |
| **Re-enable** | `add-peer` (same pubkey + IP) | `active` | unchanged | **works again, unchanged** |
| **Revoke** (terminal) | `remove-peer` | `revoked` | released to pool | dead |
| **Reassign** to another user | remove old peer, add new | old `revoked` + `replaced_by_id` → new | old released, new allocated | dead; new user gets a new file |

- **Unassign returns a config to the pool only if it was never delivered.** Once the `.conf`
  has left the building the holder keeps a copy, so re-handing that same config to someone
  else is the hole described under Reassign — revoke it and generate a fresh spare instead.
- Disable is *exactly* reversible: a WireGuard config is only key + endpoint, so re-adding the
  same pubkey and IP makes the user's original file resume working — no re-download needed.
- **Reassign issues a fresh keypair; it never transfers the old one.** The previous holder
  still has the `.conf` on disk, and two devices sharing one key flap the handshake (§12), so
  a DB-level hand-over would leave a working tunnel behind. One button in the UI, revoke +
  re-issue underneath, linked by `replaced_by_id` for the audit trail.
- No separate **rotate-key** action: re-keying for the same user is revoke + issue, so the
  capability exists without its own button.
- Records are **soft-deleted only** — a revoked config keeps its row (pubkey, timestamps,
  `issued_by`) because §9 requires the audit trail to outlive the config.

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
- The two steps are independent, same as managed (§5): an uploaded `.conf` can sit
  `unassigned` in the vault until someone needs one.
- "Revoke" for a static config = un-assign / hide it (the tunnel still exists on Proton's
  side until the admin removes the device in Proton's own account — out of our control).
- **Lifecycle differs from managed** (§5): there is no peer to remove, so *disable* and
  *revoke* both reduce to un-assign/hide, and *reassign* just re-points the same stored file.
  The UI must not offer managed-style guarantees here — the tunnel keeps working until an
  admin deletes the device inside Proton.

Same "issue config" UX as managed; different engine. This is the one capability that is
storage-only, by nature of the provider.

---

## 7. Node agent — protocol

A minimal authenticated HTTP(S) service on each node. The control plane is the only caller.

| Endpoint | Purpose |
|---|---|
| `POST /peers` `{pubkey, allowed_ip}` | add a peer (`wg set`) |
| `DELETE /peers/{pubkey}` | remove a peer (pubkey **base64url**, see below) |
| `GET /peers` | list peers + last-handshake / transfer (for status) |
| `GET /health` | liveness + node pubkey + wg status |

- **Key encoding:** a WireGuard key is base64 and contains `/` and `+`, so in the `DELETE` path
  it travels **base64url** (unpadded) — percent-encoding would make correctness depend on how the
  agent's router handles `%2F`. In JSON bodies it is plain base64. The agent accepts either.
- **Auth:** bearer token per node (stored in the DB, per node), required on **every** endpoint
  including `/health`, which would otherwise leak the node's public key. mTLS optional later.
- **Implementation:** the agent talks to the kernel over **netlink** (`wgctrl`), never by shelling
  out to `wg` — there is no code path that can be command-injected, and handshake/transfer
  counters come back directly.
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
- **ip_allocations** — node_id, ip, config_id, released_at?  *(IPAM: which IPs are taken per
  node. A `disabled` config keeps its row so re-enable restores the same IP; a `revoked` one
  sets `released_at` and returns the IP to the pool.)*
- **configs** — id, user_id?, device_label, source_type(`managed`|`static`), node_id?,
  pubkey?, encrypted_privkey?(managed), assigned_ip?, encrypted_conf?(static), allowed_ips,
  status(`unassigned`|`active`|`disabled`|`revoked`), replaced_by_id?, issued_by, created_at,
  assigned_at?, disabled_at?, revoked_at?
- **audit_log** — id, actor(staff/clerk_id), action, target, timestamp, detail
  *(actions include `config.generate`, `config.assign`, `config.unassign`, `config.view`,
  `config.disable`, `config.enable`, `config.revoke`, `config.reassign`)*

Notes:
- managed config → `pubkey`+`encrypted_privkey`+`assigned_ip`+`node_id`; static config →
  `encrypted_conf`.
- a user has **many** configs (per device, per node).
- IPAM lives in `ip_allocations` so the control plane never double-assigns an IP.
- `user_id` is **null while `unassigned`** — a generated spare has no owner until assigned (§5).
- An unassigned spare **still holds its IP**, so idle spares eat into the node's CIDR. A `/24`
  gives 254 usable addresses per node; size pools with the spare pool in mind (`/22` if spares
  are kept in bulk). Re-IPing a live node later is painful.
- `replaced_by_id` chains a reassigned config to the fresh one issued in its place, so a
  `revoked` row with a non-null `replaced_by_id` reads as a hand-over rather than a plain
  revoke — no extra status value needed.

---

## 9. Security model

The control plane becomes the **highest-value target** — if breached, every node's peers
and the client list are exposed; if down, no new configs issue.

- Staff access: Clerk + **MFA required**; RBAC enforced server-side on every route.
- Secrets at rest (Neon): encrypt `agent_token`, `encrypted_conf`, and `encrypted_privkey`
  with an **app-held key kept outside Neon** (droplet env / secret store), so a database-only
  leak yields ciphertext rather than live tunnels.
- Client keys are generated server-side and **retained** so an admin can rebuild any `.conf`
  on demand (§13). That convenience has a price, stated plainly: the control plane holds every
  client private key, so a compromise of *both* the DB and the app key exposes every tunnel.
  Mitigations — admin-only retrieval (ops never sees key material, §2), every retrieval
  written to `audit_log`, and rate-limiting on the retrieval endpoint.
- Unassigned spares are **inert**: no peer exists on any node until assignment (§5), so a
  leaked spare file cannot connect and there is no such thing as an ownerless live tunnel.
- Node agents: per-node bearer token (rotate-able); agent bound to control-plane origin;
  peer-management-only surface.
- Full **audit log** — who issued / retrieved / disabled / revoked / reassigned / logged in, when.
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
- Generate / assign / disable / re-enable / revoke / reassign a self-hosted config (full IPAM)
- Node-first issue flow: pick a node → generate spares → assign now or later
- Admin retrieval of any config (rebuild `.conf` from `encrypted_privkey`, audit-logged)
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
- **Nodes must not run on metered-egress cloud.** Full-tunnel (§5) means a node carries *all*
  of a user's traffic, and AWS/GCP egress at ~$0.09/GB makes that ruinous — one heavy user can
  outcost the server. Nodes want bundled-terabyte VPS. The control plane is the opposite case:
  dashboards, API calls and KB-sized `.conf` downloads only, so EC2 is fine there.
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

Decided 2026-09-20:
- **Client private keys are generated server-side and retained encrypted**, so an admin can
  retrieve any config at any time. Browser-side generation (server never sees the key) was
  rejected for UI cost; discard-after-display was rejected because admin retrievability is a
  support requirement. The resulting exposure is owned explicitly in §9.
- **Config lifecycle = generate / assign / unassign / disable / re-enable / revoke / reassign**
  (§5). No separate rotate-key
  action — re-keying is revoke + issue.
- **Generate and assign are separate steps.** An admin can mint unassigned spares on a node
  and hand them out later; the WireGuard peer is created **on assign**, not on generate, so a
  spare is inert until it has an owner (§5).
- **Key material is admin-only** — ops gets metadata plus the disable/revoke kill switch, never
  a private key (§2).

Still to decide:
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
