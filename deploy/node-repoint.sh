#!/bin/bash
# Run ON a node as root: re-point the agent-port lock (51821/tcp) from the old control-plane address to the
# new one. Idempotent. Handles iptables (incl. the nftables shim) and ufw; prints the resulting rules.
#   sudo bash node-repoint.sh <old-ip> <new-ip>
set -euo pipefail
OLD="${1:?old control-plane IP}"; NEW="${2:?new control-plane IP}"; PORT=51821
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  echo "ufw is active"
  ufw status numbered | grep -E "$PORT.*$OLD" | grep -oE '^\[ *[0-9]+\]' | tr -d '[] ' | sort -rn | while read -r n; do yes | ufw delete "$n" >/dev/null; done
  ufw status | grep -qE "$PORT/tcp.*$NEW" || ufw allow proto tcp from "$NEW" to any port "$PORT" comment 'cloud-vpn control plane' >/dev/null
  ufw reload >/dev/null; ufw status numbered | grep -E "$PORT" | sed 's/^/  /'
fi
if command -v iptables >/dev/null; then
  echo "iptables INPUT rules for $PORT:"
  # remove every rule that allows the old address on the agent port
  while iptables -C INPUT -p tcp --dport "$PORT" -s "$OLD" -j ACCEPT 2>/dev/null; do iptables -D INPUT -p tcp --dport "$PORT" -s "$OLD" -j ACCEPT; done
  # allow the new one, inserted at the top so a later DROP/REJECT on the port cannot shadow it
  iptables -C INPUT -p tcp --dport "$PORT" -s "$NEW" -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport "$PORT" -s "$NEW" -j ACCEPT
  iptables -S INPUT | grep -E "$PORT" | sed 's/^/  /'
  if command -v ip6tables >/dev/null; then echo "ip6tables INPUT rules for $PORT (should drop):"; ip6tables -S INPUT | grep -E "$PORT" | sed 's/^/  /' || echo "  (none)"; fi
  if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null && echo "persisted via netfilter-persistent"
  elif [ -d /etc/iptables ]; then iptables-save > /etc/iptables/rules.v4 && ip6tables-save > /etc/iptables/rules.v6 2>/dev/null; echo "persisted to /etc/iptables/rules.v4"
  else echo "WARNING: no persistence package found; the rule will not survive a reboot (apt install iptables-persistent)"; fi
fi
echo "reachability from $NEW must now be tested from the control plane."
