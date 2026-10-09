@echo off
title QC Maestro - GitHub Auto Update Service
echo Memulai QC Maestro Auto-Update Watcher...
cd /d "%~dp0\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-updater.ps1"
pause
