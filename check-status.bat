@echo off
chcp 65001 >nul
title QC Maestro - System Status
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-system-status.ps1"
echo.
pause
