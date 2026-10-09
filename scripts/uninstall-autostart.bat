@echo off
title QC Maestro - Hapus Auto-Start Windows
color 0C
echo ========================================================
echo   QC MAESTRO - HAPUS AUTO-START WINDOWS
echo ========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup); ^
   $shortcutPath = Join-Path $startup 'QCMaestroServer.lnk'; ^
   if (Test-Path $shortcutPath) { ^
       Remove-Item $shortcutPath -Force; ^
       Write-Host '[BERHASIL] Shortcut Auto-Start telah dihapus dari folder Startup.' -ForegroundColor Green; ^
   } else { ^
       Write-Host '[INFO] Shortcut Auto-Start tidak ditemukan.' -ForegroundColor Yellow; ^
   }"

echo.
pause
