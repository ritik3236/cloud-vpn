#!/bin/bash
# Run every minute by the logmania agent on a node with no client to test from:
#   CHECK_tunnel=/usr/local/bin/vpn-probe.sh tunnel <the node's Elastic IP>
# It proves the node can carry a tunnel, not that a client got through. Handshake age is only reported:
# an idle client stops handshaking, so an old one means nothing.
#   exit 0 ok · 2 critical; the output is the alert text.
set -uo pipefail
IFACE=${IFACE:-wg0} WG_PORT=${WG_PORT:-51820} AGENT_PORT=${AGENT_PORT:-51821}

fail() { echo "$1"; exit 2; }

# Three services, IPv4 only: one of them being down is not an outage.
public_ip() {
  local u ip
  for u in https://api.ipify.org https://checkip.amazonaws.com https://ifconfig.me/ip; do
    ip=$(curl -4 -s --max-time 6 "$u" 2>/dev/null | tr -d '[:space:]')
    [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] && { echo "$ip"; return 0; }
  done
  return 1
}

[ "${1:-}" = tunnel ] && [ -n "${2:-}" ] || fail "usage: $0 tunnel <expected public IP>"
expected=$2

port=$(wg show "$IFACE" listen-port 2>/dev/null) || fail "$IFACE is down: no client can connect"
[ "$port" = "$WG_PORT" ] || fail "$IFACE listens on '$port', configs point at $WG_PORT"
[ "$(sysctl -n net.ipv4.ip_forward)" = 1 ] || fail "ip_forward is off: clients connect but reach nothing"

wan=$(ip route show default | awk '{print $5; exit}')
[ -n "$wan" ] || fail "no default route"
iptables -t nat -C POSTROUTING -o "$wan" -j MASQUERADE 2>/dev/null \
  || fail "NAT rule on $wan is missing: clients connect but reach nothing"
iptables -C FORWARD -i "$IFACE" -j ACCEPT 2>/dev/null || fail "FORWARD rule for $IFACE is missing"

systemctl is-active --quiet cloud-vpn-agent || fail "cloud-vpn-agent is down: the control plane cannot add or revoke peers"
ss -Hltn "sport = :$AGENT_PORT" | grep -q . || fail "nothing listens on agent port $AGENT_PORT"

actual=$(public_ip) || fail "no internet from the node: all three IP services failed"
[ "$actual" = "$expected" ] || fail "public IP is $actual, configs point at $expected: is the Elastic IP detached?"

now=$(date +%s)
peers=0 active=0
while read -r _ ts; do
  peers=$((peers + 1))
  [ "$ts" -gt $((now - 180)) ] && active=$((active + 1))
done < <(wg show "$IFACE" latest-handshakes)
echo "$IFACE up on $actual:$port via $wan, $peers peers, $active active in the last 3 min"
