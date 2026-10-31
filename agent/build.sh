#!/bin/sh
# Builds the static linux/amd64 and linux/arm64 agents into agent/dist/ with their checksums,
# under the same names the Docker image serves. Needs Docker; no Go toolchain on the host. The
# control plane serves whatever is in dist/, so a deploy that ships the app without running this
# will serve a stale agent.
set -eu
cd "$(dirname "$0")"
mkdir -p dist
docker run --rm -v "$PWD:/src" -w /src golang:1.23 sh -c '
  go vet ./... &&
  for arch in amd64 arm64; do
    CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags "-s -w" -o dist/cloud-vpn-agent-linux-$arch . &&
    (cd dist && sha256sum cloud-vpn-agent-linux-$arch > cloud-vpn-agent-linux-$arch.sha256) || exit 1
  done
'
ls -l dist/
