#!/bin/sh
# Builds the static linux/amd64 agent into agent/dist/ and writes its checksum. Needs Docker;
# no Go toolchain on the host. The control plane serves whatever is in dist/, so a deploy that
# ships the app without running this will serve a stale agent.
set -eu
cd "$(dirname "$0")"
mkdir -p dist
docker run --rm -v "$PWD:/src" -w /src golang:1.23 sh -c '
  CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o dist/cloud-vpn-agent . &&
  go vet ./... &&
  cd dist && sha256sum cloud-vpn-agent > cloud-vpn-agent.sha256
'
ls -l dist/
