#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q && apt-get install -yq curl unzip ca-certificates
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o /tmp/awscli.zip && unzip -q /tmp/awscli.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscli.zip
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
install -d -m 0750 -o ubuntu -g ubuntu /opt/cloud-vpn
docker compose version > /var/log/cloud-vpn-bootstrap.done
