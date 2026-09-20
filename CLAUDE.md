@AGENTS.md

# CLAUDE.md — Cloud VPN control plane

Domain authority is **[SPEC.md](SPEC.md)** — roles (§2), provisioning and config lifecycle (§5),
the static/Proton driver (§6), the agent protocol (§7), the data model (§8), the security model
(§9). If code and spec disagree, the spec wins or the spec gets updated — never a silent drift.

Build rules are adapted from `~/dev-notes/guideline/` (read the relevant section before writing
for a surface). Where this file and that guide differ, **this file wins** — the differences are
deliberate and listed below.

## Deliberate departures from the guideline

The guide describes a *frontend over a standalone backend*. This app **is** the backend.

| Guide says | Here |
|---|---|
| No ORM/DB in Next | Prisma → Neon lives in `src/server/` |
| NextAuth mirrors backend session | **Clerk**; roles checked server-side (§2) |
| `api/` wraps the app's backend | `api/` wraps the **node agents** (§7) — the only remote service |
| Route-handler proxy hides a bearer | Not needed; no external backend token in play |

## Layers — dependencies point inward only

```
app/ (thin routes) → features/<domain>/ → api/ (agent contracts) + server/ (prisma, domain) → lib/ → design-system/
```

ESLint `no-restricted-imports` enforces this; do not weaken a fence to make an import work.

## Non-negotiables

- **pnpm only** (never npm/yarn).
- **Next 16**: the file is `src/proxy.ts` with a `proxy` export — *not* `middleware.ts`. `cookies`,
  `headers`, `params`, `searchParams` are **async**. Read `node_modules/next/dist/docs/` before
  writing app code; this version differs from training data.
- **Every agent call is a `defineAgentEndpoint`** in `api/` with zod **request + response**. Never
  `fetch` an agent from a feature. Response validation is load-bearing: an agent that drifts must
  fail loudly, because a silently-wrong revoke is a security bug.
- **Key material is admin-only** (§2). Never return `encrypted_privkey`, `encrypted_conf` or
  `agent_token` to a non-admin, never log plaintext key material, and write an `audit_log` row for
  every retrieval.
- **Encrypt before persisting** — private keys, static `.conf`s and agent tokens go through
  `server/crypto.ts`. `APP_ENCRYPTION_KEY` never enters Neon.
- **Never re-hand a delivered key** (§5). Reassign = revoke + issue fresh, linked by
  `replaced_by_id`. Unassign only applies to a config that was never delivered.
- **Prisma**: one client, from `@/server/db`. Migrations run against a **dev branch**, never prod
  (`~/dev-notes/neon-branching-and-auth.md`); additive migration = migrate-then-deploy.
- **RSC-first**; thin pages; the **URL is list state**; mutations = `server action → toast →
  router.refresh()`. No client data-cache library.
- **Tokens only** — no raw hex, no `dark:` utilities; dark mode is a variable swap.
- **One control height (`h-8`)**; Radix/shadcn for every overlay/menu/dialog/drawer.
- **Never disable CTAs** for validation: validate on submit, toast the first unmet requirement.
- **Give the UI a spine** — named sections, compound fields contained in a card, special data
  (secrets, destructive actions) *looks* special at rest, empty states are invitations with a named
  CTA (`+ Generate Config`, never `+ Add`), name the verb (`Revoke Config`, never `Confirm`). Two
  views of one value toggle — they don't tile. Dialogs: fixed header/footer, scroll only the body
  (`min-h-0 flex-1`). Full recipe: `~/dev-notes/guideline/recipes/ui-needs-a-spine.md`.
- **States always present:** loading skeleton · empty · error (`role="alert"`).
- **Hygiene:** delete the loser when a replacement wins; no `any` on shared surfaces; one source of
  truth per concept.

## How to work

- Ask when in doubt; don't infer scope.
- Architect before coding — mirror existing patterns rather than inventing parallel ones.
- Chain dependent shell steps into one command; parallelize independent work.
- Verify by looking (run it, light **and** dark). A clean typecheck is not proof.
- Self-critique the diff; delete dead code as you go; sweep the whole bug class.
- Confirm before anything irreversible. **Never open a PR.**

## Commits

`CVPN-<N>: description` — `<N>` is the next integer after the highest on the branch. One logical
change per commit; short subject, no body, no `Co-Authored-By`.

## Definition of done

typecheck + lint clean · looked at in light **and** dark · loading/empty/error states exist ·
keyboard-reachable with a visible focus ring · every agent call declared in `api/` · has a spine.
