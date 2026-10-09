@echo off
title QC Maestro - Continuous Deployment Watcher
color 0A
echo ========================================================
echo   QC MAESTRO - AUTO PULL ^& DOCKER AUTO-UPDATE DAEMON
echo ========================================================
echo  Daemon ini akan memantau repositori GitHub setiap 20 detik.
echo  Jika ada push baru ke branch 'main', server akan otomatis:
echo    1. git pull origin main
echo    2. docker compose up -d --build
echo ========================================================
echo.

cd /d %~dp0\..

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-and-deploy.ps1"

pause
