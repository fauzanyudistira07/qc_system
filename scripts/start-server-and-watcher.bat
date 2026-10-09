@echo off
title QC Maestro - Boot Server & Auto-Updater
cd /d "%~dp0\.."

:: 1. Pastikan container Docker menyala di background
echo [%DATE% %TIME%] Memastikan Docker containers QC Maestro menyala...
docker compose up -d

:: 2. Jalankan Cloudflare Remote Tunnel & WhatsApp Notifier di background
echo [%DATE% %TIME%] Menjalankan Cloudflare Tunnel & WhatsApp Notifier...
start /b "" node "%~dp0tunnel-notifier.mjs"

:: 3. Jalankan Auto-Update Watcher
echo [%DATE% %TIME%] Menjalankan Auto-Update Watcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-and-deploy.ps1"
