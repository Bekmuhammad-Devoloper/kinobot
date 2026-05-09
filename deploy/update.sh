#!/bin/bash
# Tez yangilash skripti — git pull + build + pm2 restart
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kinobot}"
cd "$APP_DIR"

echo "→ Git pull"
git fetch --all
git reset --hard origin/main

echo "→ Install deps"
npm ci --no-audit --no-fund

echo "→ Build"
npm run build

echo "→ Restart"
pm2 restart kinobot --update-env
pm2 status
