#!/bin/bash
# Asks for Cloud VPN's Clerk keys (hidden input), checks the publishable key belongs to clerk.tech.bizdaddy.ae,
# stores both in Parameter Store (us-east-1, /cloud-vpn/*). Prints nothing secret.
set -euo pipefail
read -rsp "Publishable key (pk_live_...): " PK; echo
read -rsp "Secret key (sk_live_...):      " SK; echo
[[ "$PK" == pk_live_* ]] || { echo "publishable key must start with pk_live_ (pk_test_ is the dev instance)"; exit 1; }
[[ "$SK" == sk_live_* ]] || { echo "secret key must start with sk_live_"; exit 1; }
dom=$(printf '%s' "${PK#pk_live_}" | base64 -d 2>/dev/null | tr -d '$' || true)
echo "publishable key belongs to: ${dom:-?}"
[ "$dom" = "clerk.tech.bizdaddy.ae" ] || { echo "that is not the tech.bizdaddy.ae instance; pick the instance whose domain is tech.bizdaddy.ae"; exit 1; }
aws ssm put-parameter --region us-east-1 --name /cloud-vpn/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --type SecureString --value "$PK" --overwrite --query Version --output text >/dev/null
aws ssm put-parameter --region us-east-1 --name /cloud-vpn/CLERK_SECRET_KEY --type SecureString --value "$SK" --overwrite --query Version --output text >/dev/null
echo "stored both. Also paste them into ~/dev-notes/_private/cloud-vpn-credentials.md (the ones there are the old vpn.zoiee.me instance)."
