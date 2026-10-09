@echo off
title QC Maestro - Launcher
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================================
echo           QC MAESTRO - AUTONOMOUS QA PLATFORM
echo ================================================================
echo Memulai QC Maestro beserta Docker, Database, API, dan Web UI...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-all.ps1"

pause
