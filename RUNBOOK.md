# Runbook: rebuilding the Cloud VPN control plane from nothing

Everything secret lives in two places that must agree: this repo's git-ignored `_private/credentials.md`
(current values, rebuild facts, node access) and AWS Parameter Store `us-east-1` `/cloud-vpn/*`.
This file holds no secrets. Written after the 2026-10-31 rebuild (the original server was deleted;
nothing was lost because all state is in Neon and Clerk).

## What exists, and what holds state

| Piece | Where | Holds state? |
|---|---|---|
| Postgres (Neon) | branch endpoint `ep-dry-cloud-az0dyuss` (ap-southeast-1) | **yes**: users, nodes, configs |
| Auth (Clerk) | instance with domain `tech.bizdaddy.ae`, frontend API `clerk.tech.bizdaddy.ae` | **yes**: staff accounts |
| `APP_ENCRYPTION_KEY` | vault + Parameter Store | **yes**: without the exact value every stored key/token is unreadable |
| Control-plane box | EC2 in `us-east-1`, Elastic IP, Docker Compose (`app` + Caddy) | no: rebuildable from this repo |
| Nodes | one WireGuard VPS each, running the Go agent | config is in Neon; the node's own WG keys are on the node |
| DNS | `bizdaddy.ae` at WordPress.com: `tech` A → the Elastic IP | no |

## 1. AWS (once per rebuild, ~10 min)

Region is a decision, not a default: `us-east-1` since 2026-10-31. The box is **arm64** (`t4g.small`):
the GHCR image is amd64-only, so the image is built on the owner's Mac and shipped over SSH.

```bash
# firewall group: 80 + 443 open; 22 only from the owner's IP (added by the owner)
aws ec2 create-security-group --group-name cloud-vpn --description "cloud-vpn control plane" --vpc-id <default-vpc>
aws ec2 authorize-security-group-ingress --group-id <sg> --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},{"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]'
# role: SSM access + read its own secrets (policy in deploy/iam-cloud-vpn-runtime.json)
aws iam create-role --role-name cloud-vpn-ec2 --assume-role-policy-document file://deploy/iam-trust-ec2.json
aws iam attach-role-policy --role-name cloud-vpn-ec2 --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam put-role-policy --role-name cloud-vpn-ec2 --policy-name cloud-vpn-runtime --policy-document file://deploy/iam-cloud-vpn-runtime.json
aws iam create-instance-profile --instance-profile-name cloud-vpn-ec2 && aws iam add-role-to-instance-profile --instance-profile-name cloud-vpn-ec2 --role-name cloud-vpn-ec2
# key pair = the owner's relay key (public half), so the image can be shipped over SSH
aws ec2 import-key-pair --key-name relay --public-key-material fileb://<relay-ssh.pub>
# box: Ubuntu 24.04 arm64, Docker + AWS CLI + 2 GB swap via deploy/user-data.sh
ami=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
aws ec2 run-instances --instance-type t4g.small --image-id $ami --security-group-ids <sg> --key-name relay \
  --iam-instance-profile Name=cloud-vpn-ec2 --user-data file://deploy/user-data.sh \
  --metadata-options HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3","Encrypted":true}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cloud-vpn}]'
aws ec2 allocate-address --domain vpc && aws ec2 associate-address --instance-id <id> --allocation-id <alloc>
```

## 2. Secrets into Parameter Store

Seven parameters under `/cloud-vpn/`: `DATABASE_URL` (pooled), `DIRECT_URL` (unpooled), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `APP_ENCRYPTION_KEY`, `APP_DOMAIN` (String, `tech.bizdaddy.ae`), optionally `GHCR_PAT`.
Load them with hidden input, never by pasting into a chat, with `deploy/set-neon.sh` and `deploy/set-clerk.sh`
( the Clerk one refuses a publishable key that does not decode to
`clerk.tech.bizdaddy.ae`). Checks that bit us:

- A Clerk publishable key encodes its frontend domain (`base64 -d` of the part after `pk_live_`). A key from a retired
  instance makes the browser fail with `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` on `clerk.browser.js`.
- The Neon **branch** matters: only `ep-dry-cloud-az0dyuss` has production data. Verify with a `pg` client before trusting
  a connection string: Prisma reports a wrong password as `P1001 Can't reach database server`, the same text as a real
  network failure.

## 3. Build, ship, start

```bash
pk=$(aws ssm get-parameter --region us-east-1 --name /cloud-vpn/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --with-decryption --query Parameter.Value --output text)
docker buildx build --platform linux/arm64 --provenance=false --sbom=false --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$pk" -t cloud-vpn:local --load .
docker save cloud-vpn:local | gzip -1 | ssh ubuntu@<eip> 'gunzip | docker load'
scp deploy/box-compose.yml ubuntu@<eip>:/opt/cloud-vpn/docker-compose.yml
scp deploy/box-deploy.sh Caddyfile ubuntu@<eip>:/opt/cloud-vpn/
ssh ubuntu@<eip> /opt/cloud-vpn/box-deploy.sh      # writes .env from Parameter Store, runs migrations, starts app + Caddy
```

`deploy/box-compose.yml` gives the app `NODE_OPTIONS=--dns-result-order=ipv4first` **and** disables IPv6 in the
container: the box has no IPv6 route and Neon resolves to an IPv6 address first; without both, Prisma fails with `P1001`.

## 4. DNS and certificate

Point `tech` (A) at the Elastic IP at WordPress.com. Caddy fetches the Let's Encrypt certificate by itself within a minute
of the record resolving. Verify: `curl -s -o /dev/null -w '%{http_code}' https://tech.bizdaddy.ae/install.sh` → 200.
Mind local DNS caches: the zone's wildcard means a stale cache shows the WordPress site instead of a failure.

## 5. Nodes

Every node locks its agent port `51821/tcp` to the control plane's address (plus loopback and its own IP) and drops it on
IPv6. When the control-plane address changes, run on each node as root:
`deploy/node-repoint.sh <old-ip> <new-ip>` (idempotent, persists via netfilter-persistent). Then from the box:
`timeout 6 bash -c '</dev/tcp/<node-ip>/51821' && echo open`. New nodes enroll with `/install.sh` served by the app.
A node that answers nothing on any port from two different networks is gone, not firewalled: remove it in the dashboard.

London and Ireland report to logmania (`../noel/logmania/agents/vpn-*.conf`, SSM install). `deploy/node-probe.sh` is copied by hand to
`/usr/local/bin/vpn-probe.sh` on each and run every minute as `CHECK_tunnel`: interface, port, forwarding, NAT, agent, public IP. A failure alerts on Telegram.
It does not prove a client got through.

## 6. After a rebuild

- Rotate anything that was ever pasted into a chat or a ticket (Neon role password, Clerk secret key).
- Update `_private/credentials.md` and Parameter Store together.
- Delete the old box's key pair file if one is left over.
