#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p .qc-artifacts

echo "================================================================"
echo "   QC MAESTRO - MASTER ALL-IN-ONE LAUNCHER (LINUX)"
echo "================================================================"
echo " Waktu Mulai : $(date '+%d %B %Y %H:%M:%S %Z')"
echo " Lokasi      : $DIR"
echo "----------------------------------------------------------------"

# 1. Pastikan Docker aktif
echo ""
echo "🔍 [1/4] Memeriksa status Docker..."
if docker info >/dev/null 2>&1; then
    echo "   ✅ Docker Engine aktif."
    echo "   📦 Menyalakan kontainer database (Postgres, Redis, MinIO)..."
    docker compose -f infrastructure/compose/docker-compose.yml up -d
else
    echo "   ⚠️ Docker daemon belum berjalan. Jalankan 'sudo systemctl start docker' jika ingin fitur database Docker."
fi

# 2. Bersihkan port jika ada proses lama
echo ""
echo "🧹 [2/4] Membersihkan port dan proses lama..."
fuser -k 4100/tcp 4180/tcp 2>/dev/null || true
pkill -f "tunnel-notifier.mjs" 2>/dev/null || true
pkill -f "watch-and-deploy.sh" 2>/dev/null || true

# 3. Jalankan Dev Server di background
echo ""
echo "⚡ [3/4] Menyalakan Backend API & Web Dashboard..."
nohup npm run dev > .qc-artifacts/server.log 2>&1 &
SERVER_PID=$!
echo "   ✅ Server berjalan di background (PID: $SERVER_PID)."

# 4. Tunggu server siap sebentar
sleep 3

# 5. Jalankan WhatsApp Notifier di background
echo ""
echo "📱 [4/4] Mengirim Notifikasi Link Domain ke WhatsApp..."
nohup node scripts/tunnel-notifier.mjs > .qc-artifacts/tunnel.log 2>&1 &
NOTIFIER_PID=$!
echo "   ✅ WhatsApp Notifier aktif (PID: $NOTIFIER_PID)."

# 6. Jalankan GitHub Auto-Update Watcher di background
echo "🔄 Menyalakan GitHub Auto-Update Watcher..."
nohup bash scripts/watch-and-deploy.sh > .qc-artifacts/watcher.log 2>&1 &
WATCHER_PID=$!
echo "   ✅ GitHub Auto-Update Watcher aktif (PID: $WATCHER_PID)."

echo ""
echo "================================================================"
echo " 🎉 SEMUA LAYANAN QC MAESTRO BERJALAN LENGKAP DI BACKGROUND!"
echo "================================================================"
echo " 🌍 Web Dashboard (Publik) : https://timbang.tiraa.my.id"
echo " 🔌 Backend API            : http://localhost:4100"
echo " 🔑 Login Admin            : admin@qcmaestro.com / admin12345"
echo " 📱 Notifikasi WA          : Otomatis dikirim ke WhatsApp via Fonnte"
echo " 🔄 Auto Pull GitHub       : Aktif memantau branch 'main'"
echo " 📄 Log File               : .qc-artifacts/*.log"
echo " 🛑 Cara Berhenti          : Jalankan ./stop.sh"
echo "================================================================"
