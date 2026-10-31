#!/usr/bin/env bash
# Deploy chess trên server (mcp-80, /opt/chess): bash scripts/deploy-server.sh
# Giữ đúng 1 image rollback (bản ngay trước) — rollback: bash scripts/rollback-server.sh
set -euo pipefail
cd "$(dirname "$0")/.."
IMG=chess-chess

old_rb=$(docker image inspect -f '{{.Id}}' "$IMG:rollback" 2>/dev/null || true)
if docker image inspect "$IMG:latest" >/dev/null 2>&1; then
  docker tag "$IMG:latest" "$IMG:rollback"
else
  echo "WARN: chưa có $IMG:latest — lần này không có bản rollback"
fi

git pull --ff-only origin main
docker compose build chess
docker compose up -d --no-build --force-recreate chess

# Bản rollback cũ đã mất tag → xoá để không tích image trên đĩa (đang dùng thì rm tự fail, bỏ qua).
new_rb=$(docker image inspect -f '{{.Id}}' "$IMG:rollback" 2>/dev/null || true)
if [ -n "$old_rb" ] && [ "$old_rb" != "$new_rb" ]; then
  docker image rm "$old_rb" >/dev/null 2>&1 || true
fi

for _ in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:9420/healthz >/dev/null; then
    echo "OK: healthz, $(docker exec chess-app node --version)"
    exit 0
  fi
  sleep 2
done
echo "FAIL: healthz không lên — rollback: bash scripts/rollback-server.sh"
exit 1
