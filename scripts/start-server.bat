@echo off
echo ========================================================
echo  QC MAESTRO - AUTO SERVER DOCKER STARTER
echo ========================================================
cd /d %~dp0\..
docker compose up -d --build
echo.
echo ========================================================
echo  QC Maestro Server sudah berjalan di Docker!
echo  Web UI: http://localhost:4180
echo  API   : http://localhost:4100
echo ========================================================
pause
