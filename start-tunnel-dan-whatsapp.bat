@echo off
chcp 65001 >nul
title QC Maestro - Cloudflare Tunnel & WhatsApp Notifier
color 0B
echo ========================================================
echo    QC MAESTRO - CLOUDFLARE TUNNEL ^& WHATSAPP NOTIFIER
echo ========================================================
echo  Menghubungkan server lokal ke internet via Cloudflare...
echo  Link publik akan otomatis dikirimkan ke WhatsApp Anda.
echo ========================================================
echo.

cd /d "%~dp0"
node scripts\tunnel-notifier.mjs

echo.
pause
