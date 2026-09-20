# Cloud VPN node agent

A small Go binary that runs on each managed node and exposes the peer-management API the control
plane calls (SPEC §7). It is the **entire** privileged surface on a node: add a peer, remove a
peer, read state. Nothing else.

It talks to the kernel over netlink via `wgctrl` — it never shells out to `wg`, so there is no
code path that can be command-injected, and handshake/transfer counters come back directly.

## Build

```bash
cd agent && go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o cloud-vpn-agent .
```

`CGO_ENABLED=0` gives a static binary that runs on any Linux node regardless of libc — the
"drop-on-any-VPS with zero deps" property SPEC §4 asks for.

## Test

```bash
docker run --rm --cap-add NET_ADMIN -v "$PWD:/src" -w /src golang:1.23 bash /src/e2e-test.sh
```

Creates a live `wg0` inside the container's own network namespace, runs the agent against it, and
asserts the §7 contract — including that an added peer really appears in `wg show`, not just in
the agent's reply. The host's networking is untouched.

## Configuration

Environment only; no config file.

| Variable | Default | Meaning |
|---|---|---|
| `AGENT_TOKEN` | — | **required**; the per-node bearer token, stored encrypted in `nodes.agent_token` |
| `WG_INTERFACE` | `wg0` | interface to manage |
| `LISTEN_ADDR` | `:51821` | agent API listen address (not the WireGuard UDP port) |
| `TLS_CERT_FILE` | — | serve HTTPS directly; omit to run behind a TLS-terminating proxy |
| `TLS_KEY_FILE` | — | must be set together with the cert |

## Install

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cvpn-agent
sudo install -m 0755 cloud-vpn-agent /usr/local/bin/cloud-vpn-agent
sudo install -d -m 0750 -o root -g cvpn-agent /etc/cloud-vpn-agent
printf 'AGENT_TOKEN=%s\n' "$(openssl rand -base64 32)" | sudo tee /etc/cloud-vpn-agent/env >/dev/null
sudo chmod 0640 /etc/cloud-vpn-agent/env && sudo chgrp cvpn-agent /etc/cloud-vpn-agent/env
sudo install -m 0644 cloud-vpn-agent.service /etc/systemd/system/
sudo systemctl enable --now cloud-vpn-agent
```

The unit runs the agent as an unprivileged user with only `CAP_NET_ADMIN`, not as root.

## Firewall

- WireGuard's UDP port: open to the world (that is how clients connect).
- The agent port: open **only** to the control plane's Elastic IP. The control plane keeps a
  stable IP precisely so this allowlist is possible (SPEC §7).

## Behaviour worth knowing

- **Every endpoint requires the bearer token**, including `/health` — it reveals the node's
  public key.
- **Idempotent by design**: re-adding an existing peer replaces its allowed IPs; removing an
  absent peer succeeds. A retried call after a network blip is always safe (SPEC §7).
- **Startup fails loudly** if the interface is missing or `CAP_NET_ADMIN` is absent, so a broken
  node is caught at onboarding rather than when a kill switch is first pulled.
- **A peer that has never handshaked reports `last_handshake: null`**, not a 1970 timestamp.
