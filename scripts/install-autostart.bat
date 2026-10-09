@echo off
title QC Maestro - Setup Windows Auto-Start
color 0B
echo ========================================================
echo   QC MAESTRO - DAFTARKAN AUTO-START WINDOWS (BOOT)
echo ========================================================
echo.
echo Sedang mendaftarkan script ke Windows Startup...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal mendaftarkan auto-start. Silakan periksa pesan di atas.
) else (
    echo.
    echo ========================================================
    echo  SELESAI DENGAN SUKSES!
    echo  Setiap kali laptop server dinyalakan/login Windows:
    echo  1. Docker QC Maestro akan otomatis menyala
    echo  2. Auto-Update GitHub Watcher akan otomatis berjalan
    echo ========================================================
)
echo.
pause
