#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "========================================================"
echo "   QC MAESTRO - CLOUDFLARE TUNNEL & WHATSAPP NOTIFIER   "
echo "========================================================"
echo " Menghubungkan server lokal ke internet via Cloudflare..."
echo " Link publik akan otomatis dikirimkan ke WhatsApp Anda."
echo "========================================================"
echo ""

node scripts/tunnel-notifier.mjs
