#!/bin/bash
# Runs ON the box as ubuntu. Writes .env from Parameter Store (the instance role may read /cloud-vpn/*),
# then (re)starts the stack with whatever cloud-vpn:local image was loaded last.
set -euo pipefail
cd /opt/cloud-vpn
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
umask 077
aws ssm get-parameters-by-path --region "$REGION" --path /cloud-vpn/ --with-decryption --query 'Parameters[].[Name,Value]' --output text \
  | awk -F'\t' '{ sub(".*/", "", $1); if ($1 != "GHCR_PAT") print $1 "=" $2 }' > .env.new
for k in DATABASE_URL DIRECT_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY APP_ENCRYPTION_KEY APP_DOMAIN; do
  grep -q "^$k=" .env.new || { echo "missing $k in Parameter Store"; exit 1; }
done
mv .env.new .env
docker image inspect cloud-vpn:local >/dev/null 2>&1 || { echo "no cloud-vpn:local image loaded yet"; exit 1; }
docker compose up -d --remove-orphans
sleep 20
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
