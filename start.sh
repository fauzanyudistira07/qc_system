#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p .qc-artifacts

echo "================================================================"
echo "          QC MAESTRO - AUTONOMOUS QA PLATFORM"
echo "================================================================"
echo " Waktu Mulai : $(date '+%d %B %Y %H:%M:%S %Z')"
echo " Lokasi      : $DIR"
echo "----------------------------------------------------------------"

# Fungsi pembersihan otomatis saat ditutup (Ctrl + C / kill)
cleanup() {
    trap - SIGINT SIGTERM EXIT
    echo ""
    echo "🛑 Menghentikan semua layanan QC Maestro (Server, Tunnel, Watcher)..."
    kill $(jobs -p) 2>/dev/null || true
    pkill -f "tunnel-notifier.mjs" 2>/dev/null || true
    pkill -f "watch-and-deploy.sh" 2>/dev/null || true
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    fuser -k 4100/tcp 4180/tcp 2>/dev/null || true
    echo "✅ Semua layanan berhasil dihentikan."
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Periksa Docker Engine & Nyalakan Database
echo ""
echo "🔍 [1/4] Memeriksa status Docker Engine..."
if ! command -v docker >/dev/null 2>&1; then
    echo "   ⚠️ Docker tidak ditemukan. Lewati kontainer database..."
else
    if docker info >/dev/null 2>&1; then
        echo "   ✅ Docker Engine aktif."
        echo "   📦 Menyalakan kontainer database (PostgreSQL, Redis, MinIO)..."
        docker compose -f infrastructure/compose/docker-compose.yml up -d
        echo "   ✅ Database & Storage aktif:"
        echo "      - PostgreSQL: localhost:5432 (db: qc_maestro, user: qc)"
        echo "      - Redis     : localhost:6379"
        echo "      - MinIO S3  : localhost:9000 (Console: http://localhost:9001)"
    else
        echo "   ⚠️ Docker daemon belum aktif. Jalankan 'sudo systemctl start docker' jika butuh database Docker."
    fi
fi

# 2. Bersihkan port & proses background lama
echo ""
echo "🧹 [2/4] Membersihkan port dan proses lama..."
pkill -f "tunnel-notifier.mjs" 2>/dev/null || true
pkill -f "watch-and-deploy.sh" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
fuser -k 4100/tcp 4180/tcp 2>/dev/null || true
echo "   ✅ Port 4100 & 4180 siap digunakan."

# 3. Jalankan Cloudflare Remote Tunnel & WhatsApp Notifier di background
echo ""
echo "🌐 [3/4] Menyalakan Cloudflare Remote Tunnel & WhatsApp Notifier..."
node scripts/tunnel-notifier.mjs > .qc-artifacts/tunnel.log 2>&1 &
TUNNEL_PID=$!
echo "   ✅ Tunnel & WhatsApp Notifier aktif (PID: $TUNNEL_PID, log: .qc-artifacts/tunnel.log)"

# 4. Jalankan GitHub Auto-Update Watcher di background
echo "🔄 [4/4] Menyalakan GitHub Auto-Update Watcher..."
bash scripts/watch-and-deploy.sh > .qc-artifacts/watcher.log 2>&1 &
WATCHER_PID=$!
echo "   ✅ GitHub Auto-Update Watcher aktif (PID: $WATCHER_PID, log: .qc-artifacts/watcher.log)"

# 5. Jalankan Backend API & Web Dashboard di foreground
echo ""
echo "⚡ Memulai QC Maestro Backend API & Web Dashboard..."
echo "================================================================"
echo " 🌍 Web Dashboard      : http://localhost:4180"
echo " 🔌 Backend API        : http://localhost:4100"
echo " 🔑 Login Admin        : admin@qcmaestro.com / admin12345"
echo " 📱 Notifikasi WA      : Dikirim via Fonnte saat Tunnel siap"
echo " 🔄 Auto Pull GitHub   : Aktif memantau branch 'main'"
echo " 📄 Log Tunnel/Watcher : .qc-artifacts/*.log"
echo " 🛑 Cara Berhenti      : Tekan Ctrl + C di jendela ini atau jalankan ./stop.sh"
echo "================================================================"
echo ""

npm run dev
