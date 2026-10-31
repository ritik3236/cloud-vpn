#!/bin/bash
# Asks for Cloud VPN's two Neon connection strings (hidden input), checks their shape, stores them in
# Parameter Store (us-east-1, /cloud-vpn/DATABASE_URL and /cloud-vpn/DIRECT_URL). Prints nothing secret.
set -euo pipefail
read -rsp "Pooled connection string (host contains '-pooler.'):   " POOLED; echo
read -rsp "Direct connection string (host without '-pooler.'):    " DIRECT; echo
chk() { [[ "$2" == postgresql://* ]] || { echo "$1: must start with postgresql://"; exit 1; }
        [[ "$2" == *neondb_owner:* ]] || echo "$1: note, the role is not neondb_owner (fine if you changed it on purpose)"
        [[ "$2" == *sslmode=* ]] || echo "$1: note, no sslmode in the string; the app expects sslmode=verify-full"; }
chk pooled "$POOLED"; chk direct "$DIRECT"
[[ "$POOLED" == *-pooler.* ]] || { echo "pooled: host should contain '-pooler.' (swap the two?)"; exit 1; }
[[ "$DIRECT" != *-pooler.* ]] || { echo "direct: host must not contain '-pooler.' (swap the two?)"; exit 1; }
aws ssm put-parameter --region us-east-1 --name /cloud-vpn/DATABASE_URL --type SecureString --value "$POOLED" --overwrite --query Version --output text >/dev/null
aws ssm put-parameter --region us-east-1 --name /cloud-vpn/DIRECT_URL  --type SecureString --value "$DIRECT" --overwrite --query Version --output text >/dev/null
echo "stored both. Remember to update ~/dev-notes/_private/cloud-vpn-credentials.md with the same two strings."
