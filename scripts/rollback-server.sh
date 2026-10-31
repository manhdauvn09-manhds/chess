#!/usr/bin/env bash
# Rollback chess về image ngay trước (tag chess-chess:rollback do deploy-server.sh tạo). Không build lại.
set -euo pipefail
cd "$(dirname "$0")/.."
docker tag chess-chess:rollback chess-chess:latest
docker compose up -d --no-build --force-recreate chess
