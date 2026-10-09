@echo off
title QC Maestro - Boot Server & Auto-Updater
cd /d "%~dp0\.."

:: 1. Pastikan database & infra Docker menyala
echo [%DATE% %TIME%] Memastikan infrastruktur Docker (PostgreSQL, Redis, MinIO) menyala...
docker compose -f infrastructure\compose\docker-compose.yml up -d

:: 2. Pastikan Server QC Maestro (API 4100 & Web 4180) menyala di background
echo [%DATE% %TIME%] Menjalankan QC Maestro Dev Server (API & Web)...
start /b "" cmd /c "npm run dev"

:: 3. Jalankan Cloudflare Remote Tunnel & WhatsApp Notifier di background
echo [%DATE% %TIME%] Menjalankan Cloudflare Tunnel & WhatsApp Notifier...
start /b "" node "%~dp0tunnel-notifier.mjs"

:: 4. Jalankan Auto-Update Watcher di background
echo [%DATE% %TIME%] Menjalankan Auto-Update Watcher...
start /b "" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-and-deploy.ps1"
