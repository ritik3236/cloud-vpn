#!/bin/sh
# Cloud VPN node installer. One command turns a fresh Linux box into a managed node:
#
#   curl -fsSL https://<control-plane>/install.sh | sh -s -- --token=cvpn_… --server=https://<control-plane>
#
# The node generates its own WireGuard key and TLS certificate and registers itself. No secret
# is ever copied off this box by hand.
set -eu

TOKEN=""; SERVER=""; WG_PORT="51820"; AGENT_PORT="51821"; IFACE="wg0"
for arg in "$@"; do
  case "$arg" in
    --token=*)      TOKEN="${arg#*=}" ;;
    --server=*)     SERVER="${arg#*=}" ;;
    --wg-port=*)    WG_PORT="${arg#*=}" ;;
    --agent-port=*) AGENT_PORT="${arg#*=}" ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$TOKEN" ] && [ -n "$SERVER" ] || { echo "usage: --token=… --server=https://…" >&2; exit 2; }
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

PUBLIC_IP="$(curl -fsS https://api.ipify.org)"
echo "==> installing on ${PUBLIC_IP}"

# iptables is the nftables-backed shim; Ubuntu 26.04 ships without it and wg-quick's NAT rules
# fail with 'command not found', which rolls the interface straight back.
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq wireguard-tools iptables openssl curl

echo "==> routing sysctls"
cat > /etc/sysctl.d/99-cloud-vpn.conf <<SYSCTL
net.ipv4.ip_forward = 1
net.ipv4.conf.all.src_valid_mark = 1
SYSCTL
sysctl -q -p /etc/sysctl.d/99-cloud-vpn.conf

echo "==> wireguard"
WAN="$(ip route show default | awk '{print $5; exit}')"
install -d -m 0700 /etc/wireguard
umask 077
[ -f /etc/wireguard/${IFACE}.key ] || wg genkey > /etc/wireguard/${IFACE}.key
cat > /etc/wireguard/${IFACE}.conf <<CONF
[Interface]
Address = 10.8.0.1/24
ListenPort = ${WG_PORT}
PrivateKey = $(cat /etc/wireguard/${IFACE}.key)
PostUp = iptables -t nat -A POSTROUTING -o ${WAN} -j MASQUERADE; iptables -A FORWARD -i ${IFACE} -j ACCEPT; iptables -A FORWARD -o ${IFACE} -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o ${WAN} -j MASQUERADE; iptables -D FORWARD -i ${IFACE} -j ACCEPT; iptables -D FORWARD -o ${IFACE} -j ACCEPT
CONF
chmod 600 /etc/wireguard/${IFACE}.conf
systemctl enable --now wg-quick@${IFACE}

echo "==> agent"
id cvpn-agent >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin cvpn-agent
curl -fsSL "${SERVER}/download/cloud-vpn-agent" -o /usr/local/bin/cloud-vpn-agent
chmod 0755 /usr/local/bin/cloud-vpn-agent
install -d -m 0750 -o root -g cvpn-agent /etc/cloud-vpn-agent

# Self-signed with this node's IP in the SAN. The control plane pins it at enrollment, so no
# public CA is involved and nothing about the fleet reaches Certificate Transparency logs.
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 \
  -keyout /etc/cloud-vpn-agent/agent.key -out /etc/cloud-vpn-agent/agent.crt \
  -subj "/CN=cloud-vpn-agent" -addext "subjectAltName=IP:${PUBLIC_IP}" 2>/dev/null
AGENT_TOKEN="$(openssl rand -base64 32 | tr -d '\n')"
printf 'AGENT_TOKEN=%s\nWG_INTERFACE=%s\nLISTEN_ADDR=0.0.0.0:%s\nTLS_CERT_FILE=/etc/cloud-vpn-agent/agent.crt\nTLS_KEY_FILE=/etc/cloud-vpn-agent/agent.key\n' \
  "$AGENT_TOKEN" "$IFACE" "$AGENT_PORT" > /etc/cloud-vpn-agent/env
chmod 0640 /etc/cloud-vpn-agent/env
chgrp cvpn-agent /etc/cloud-vpn-agent/env /etc/cloud-vpn-agent/agent.key /etc/cloud-vpn-agent/agent.crt
chmod 0640 /etc/cloud-vpn-agent/agent.key /etc/cloud-vpn-agent/agent.crt

curl -fsSL "${SERVER}/download/cloud-vpn-agent.service" -o /etc/systemd/system/cloud-vpn-agent.service
systemctl daemon-reload
systemctl enable --now cloud-vpn-agent
sleep 2

echo "==> registering with ${SERVER}"
CERT_JSON="$(awk '{printf "%s\\n", $0}' /etc/cloud-vpn-agent/agent.crt)"
RESPONSE="$(curl -fsS -X POST "${SERVER}/api/nodes/enroll" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"${TOKEN}\",\"endpoint\":\"${PUBLIC_IP}:${WG_PORT}\",\"agent_url\":\"https://${PUBLIC_IP}:${AGENT_PORT}\",\"agent_token\":\"${AGENT_TOKEN}\",\"agent_cert\":\"${CERT_JSON}\"}" \
  || { echo "enrollment failed — the control plane refused this node" >&2; exit 1; })"

echo "$RESPONSE"
echo "==> done. Open ${WG_PORT}/udp to the world and ${AGENT_PORT}/tcp to the control plane."
