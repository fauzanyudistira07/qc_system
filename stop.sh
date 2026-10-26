#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "================================================================"
echo "          QC MAESTRO - STOPPING ALL SERVICES"
echo "================================================================"

echo ""
echo "🛑 Menghentikan kontainer Docker (Postgres, Redis, MinIO)..."
docker compose -f infrastructure/compose/docker-compose.yml down 2>/dev/null || true

echo ""
echo "🛑 Menghentikan proses background (Notifier, Watcher, Server)..."
pkill -f "tunnel-notifier.mjs" 2>/dev/null || true
pkill -f "watch-and-deploy.sh" 2>/dev/null || true
fuser -k 4100/tcp 4180/tcp 2>/dev/null || true

echo ""
echo "✅ Semua layanan QC Maestro, Tunnel, dan Watcher berhasil dihentikan!"
