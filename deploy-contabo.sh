#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${1:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lecrown-site}"

if [[ -z "$REMOTE_HOST" ]]; then
  echo "Usage: $0 user@server"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for deploy-contabo.sh"
  exit 1
fi

echo "Syncing site to ${REMOTE_HOST}:${REMOTE_DIR}"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR'"

rsync -az --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .DS_Store \
  ./ "$REMOTE_HOST:$REMOTE_DIR/"

echo "Starting container on ${REMOTE_HOST}"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && docker compose up -d --build"

echo "Deployment complete."
