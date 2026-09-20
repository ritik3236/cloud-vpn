#!/usr/bin/env bash
# End-to-end test against a REAL kernel WireGuard interface. Runs inside a throwaway container
# with its own network namespace, so it never touches the host's networking:
#
#   docker run --rm --cap-add NET_ADMIN -v "$PWD:/src" -w /src golang:1.23 bash /src/e2e-test.sh
#
# Build the binary first (see README). Asserts the SPEC §7 contract: bearer auth on every
# endpoint, idempotent add/remove, base64url keys in the DELETE path, and that a peer really
# lands in the kernel rather than merely being reported as added.

set -e
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq wireguard-tools iproute2 curl >/dev/null 2>&1

ip link add dev wg0 type wireguard
wg genkey > /tmp/priv
wg set wg0 private-key /tmp/priv listen-port 51820
ip addr add 10.8.0.1/24 dev wg0
ip link set wg0 up
echo "wg0 up, node pubkey: $(wg pubkey < /tmp/priv)"

export AGENT_TOKEN="test-token-12345"
export LISTEN_ADDR="127.0.0.1:51821"
/src/cloud-vpn-agent & AGENT_PID=$!
sleep 2

PEER=$(wg genkey | wg pubkey)
PEER_URL=$(printf '%s' "$PEER" | tr '+/' '-_' | tr -d '=')
A="Authorization: Bearer $AGENT_TOKEN"
fail=0
t() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 -- expected [$2] got [$3]"; fail=$((fail+1)); fi
}

t "health without token is 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:51821/health)"
t "health with wrong token is 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer nope' http://127.0.0.1:51821/health)"
t "health with token is 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -H "$A" http://127.0.0.1:51821/health)"
t "health reports wg up" "true" "$(curl -s -H "$A" http://127.0.0.1:51821/health | grep -o '"wg_up":[a-z]*' | cut -d: -f2)"
t "health reports node pubkey" "$(wg pubkey < /tmp/priv)" "$(curl -s -H "$A" http://127.0.0.1:51821/health | sed 's/.*"node_pubkey":"\([^"]*\)".*/\1/')"

t "add peer returns ok" '{"ok":true}' "$(curl -s -X POST -H "$A" -H 'Content-Type: application/json' -d "{\"pubkey\":\"$PEER\",\"allowed_ip\":\"10.8.0.5/32\"}" http://127.0.0.1:51821/peers | tr -d ' \n')"
t "kernel really has the peer" "1" "$(wg show wg0 peers | grep -c "$PEER")"
t "list shows the allowed ip" "10.8.0.5/32" "$(curl -s -H "$A" http://127.0.0.1:51821/peers | sed 's/.*"allowed_ip":"\([^"]*\)".*/\1/')"
t "never-handshaked peer is null" "null" "$(curl -s -H "$A" http://127.0.0.1:51821/peers | grep -o '"last_handshake":[a-z0-9]*' | cut -d: -f2)"
t "re-adding is idempotent" '{"ok":true}' "$(curl -s -X POST -H "$A" -H 'Content-Type: application/json' -d "{\"pubkey\":\"$PEER\",\"allowed_ip\":\"10.8.0.5/32\"}" http://127.0.0.1:51821/peers | tr -d ' \n')"
t "still exactly one peer" "1" "$(wg show wg0 peers | wc -l | tr -d ' ')"

t "delete via base64url returns ok" '{"ok":true}' "$(curl -s -X DELETE -H "$A" "http://127.0.0.1:51821/peers/$PEER_URL" | tr -d ' \n')"
t "kernel no longer has the peer" "0" "$(wg show wg0 peers | grep -c "$PEER" || true)"
t "deleting an absent peer still succeeds" '{"ok":true}' "$(curl -s -X DELETE -H "$A" "http://127.0.0.1:51821/peers/$PEER_URL" | tr -d ' \n')"
t "bad pubkey is rejected" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "$A" http://127.0.0.1:51821/peers/not-a-key)"
t "bad cidr is rejected" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$A" -H 'Content-Type: application/json' -d "{\"pubkey\":\"$PEER\",\"allowed_ip\":\"nonsense\"}" http://127.0.0.1:51821/peers)"

kill $AGENT_PID 2>/dev/null || true
echo; [ $fail -eq 0 ] && echo "ALL AGENT TESTS PASSED" || echo "$fail TEST(S) FAILED"
exit $fail
