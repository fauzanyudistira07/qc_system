@echo off
title QC Maestro - Hapus Auto-Start Windows
color 0C
echo ========================================================
echo   QC MAESTRO - HAPUS AUTO-START WINDOWS
echo ========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-autostart.ps1"

echo.
pause
