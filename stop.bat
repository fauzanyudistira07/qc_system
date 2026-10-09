@echo off
title QC Maestro - Stop All Services
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================================
echo           QC MAESTRO - STOPPING ALL SERVICES
echo ================================================================
echo Menghentikan API, Web, dan Kontainer Database...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { Write-Host '🛑 Menghentikan kontainer Docker (Postgres, Redis, MinIO)...' -ForegroundColor Yellow; docker compose -f '%~dp0infrastructure\compose\docker-compose.yml' down; Write-Host '🛑 Membersihkan proses di port 4100 dan 4180...' -ForegroundColor Yellow; Get-NetTCPConnection -LocalPort 4100, 4180 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '✅ Semua layanan QC Maestro berhasil dihentikan!' -ForegroundColor Green; }"

echo.
echo Selesai.
timeout /t 3 >nul
