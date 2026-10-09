@echo off
title QC Maestro - Setup Windows Auto-Start
color 0B
echo ========================================================
echo   QC MAESTRO - DAFTARKAN AUTO-START WINDOWS (BOOT)
echo ========================================================
echo.
echo Sedang mendaftarkan script ke Windows Startup...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $startup = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup); ^
   $shortcutPath = Join-Path $startup 'QCMaestroServer.lnk'; ^
   $vbsPath = Join-Path '%~dp0' 'run-hidden.vbs'; ^
   $sc = $ws.CreateShortcut($shortcutPath); ^
   $sc.TargetPath = 'wscript.exe'; ^
   $sc.Arguments = '`\"' + $vbsPath + '`\"'; ^
   $sc.WorkingDirectory = '%~dp0'; ^
   $sc.Description = 'QC Maestro Auto-Start Docker and GitHub Watcher'; ^
   $sc.Save(); ^
   Write-Host '[BERHASIL] Shortcut Auto-Start dibuat di:' -ForegroundColor Green; ^
   Write-Host $shortcutPath -ForegroundColor White;"

echo.
echo ========================================================
echo  SELESAI! 
echo  Setiap kali laptop server dinyalakan/login Windows:
echo  1. Docker QC Maestro akan otomatis menyala
echo  2. Auto-Update GitHub Watcher akan otomatis berjalan di background
echo ========================================================
echo.
pause
