#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"
cd "$REPO_ROOT"

CHECK_INTERVAL=20
BRANCH="main"

echo "=========================================================="
echo "  QC MAESTRO - AUTO DEPLOYMENT WATCHER (LINUX ACTIVE)    "
echo "=========================================================="
echo "Lokasi Repo   : $REPO_ROOT"
echo "Interval Cek  : Setiap $CHECK_INTERVAL detik"
echo "Branch Target : $BRANCH"
echo "Tekan [Ctrl + C] kapan saja untuk menghentikan daemon."
echo ""

STATE_FILE="$REPO_ROOT/.qc-artifacts/.last-deployed-sha"
mkdir -p "$REPO_ROOT/.qc-artifacts"
LAST_DEPLOYED_SHA=""
if [ -f "$STATE_FILE" ]; then
    LAST_DEPLOYED_SHA=$(cat "$STATE_FILE" | tr -d '[:space:]')
fi

# Verifikasi branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "$BRANCH" ] && [ -n "$CURRENT_BRANCH" ]; then
    echo "⚠️ Branch aktif saat ini adalah '$CURRENT_BRANCH'. Berpindah ke '$BRANCH'..."
    git checkout "$BRANCH" 2>/dev/null || true
fi

while true; do
    git fetch origin "$BRANCH" --quiet 2>/dev/null || true
    LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_SHA=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

    # Cek apakah remote memiliki commit baru yang BELUM ada di HEAD lokal
    # Ini mencegah spam berulang saat lokal sama dengan remote atau mendahului remote
    BEHIND_COUNT=$(git rev-list "HEAD..origin/$BRANCH" --count 2>/dev/null || echo "0")

    if [ "$BEHIND_COUNT" -gt 0 ] && [ "$REMOTE_SHA" != "$LAST_DEPLOYED_SHA" ]; then
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
        COMMIT_MSG=$(git log -1 --pretty=format:"%s" "origin/$BRANCH" 2>/dev/null || echo "Update baru")
        AUTHOR=$(git log -1 --pretty=format:"%an" "origin/$BRANCH" 2>/dev/null || echo "")

        echo ""
        echo "[$TIMESTAMP] >>> $BEHIND_COUNT COMMIT BARU TERDETEKSI DI GITHUB! <<<"
        echo "Commit SHA   : ${LOCAL_SHA:0:7} -> ${REMOTE_SHA:0:7}"
        echo "Pesan Commit : $COMMIT_MSG"
        echo "Author       : $AUTHOR"
        echo "Menjalankan update sistem..."

        # 1. Pull update
        echo "[1/3] Melakukan git pull origin $BRANCH..."
        PULL_OUTPUT=$(git pull origin "$BRANCH" 2>&1)
        PULL_EXIT=$?
        echo "$PULL_OUTPUT"

        # Simpan state SHA remote agar tidak pernah memproses commit ini dua kali
        LAST_DEPLOYED_SHA="$REMOTE_SHA"
        echo "$REMOTE_SHA" > "$STATE_FILE"

        if [ $PULL_EXIT -eq 0 ] && [[ "$PULL_OUTPUT" != *"Already up to date."* ]]; then
            NEW_LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

            # 2. Pastikan kontainer database aktif
            echo "[2/3] Memastikan kontainer database & cache aktif..."
            docker compose -f infrastructure/compose/docker-compose.yml up -d 2>/dev/null || true

            # 3. Kirim notifikasi WA (tepat 1 kali)
            echo "[3/3] Mengirim 1x notifikasi pembaruan ke WhatsApp..."
            node scripts/notify-deploy-wa.mjs --sha "$REMOTE_SHA" --msg "$COMMIT_MSG" --author "$AUTHOR" --status "success"

            echo "✅ Server QC Maestro berhasil diperbarui ke commit terbaru (${NEW_LOCAL_SHA:0:7})!"
            echo ""
        fi
    else
        TIME_NOW=$(date '+%H:%M:%S')
        printf "\r[%s] Sinkron dengan GitHub (Commit: %s). Menunggu push baru..." "$TIME_NOW" "${LOCAL_SHA:0:7}"
    fi

    sleep "$CHECK_INTERVAL"
done
