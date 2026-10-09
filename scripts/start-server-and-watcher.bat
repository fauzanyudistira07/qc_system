@echo off
title QC Maestro - Master Server Launcher
cd /d "%~dp0\.."

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-supervisor.ps1"
