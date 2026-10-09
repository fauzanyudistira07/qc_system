# QC Maestro - Master Server Supervisor for Windows
# Memastikan semua layanan (Docker, Dev Server, Tunnel, Watcher) berjalan mandiri di background.

$ErrorActionPreference = "SilentlyContinue"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " QC MAESTRO - MASTER SERVER SUPERVISOR (AUTO-START)       " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Menunggu Docker Desktop aktif (saat boot Windows, Docker butuh waktu)
Write-Host "[1/4] Memeriksa status Docker Desktop..." -ForegroundColor Cyan
$dockerRetries = 0
while ($dockerRetries -lt 30) {
    docker info > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      Docker Engine SIAP." -ForegroundColor Green
        break
    }
    Write-Host "      Menunggu Docker Engine siap (percobaan $dockerRetries/30)..." -ForegroundColor Gray
    Start-Sleep -Seconds 4
    $dockerRetries++
}

# Naikkan kontainer database
docker compose -f infrastructure\compose\docker-compose.yml up -d > $null 2>&1
Write-Host "      Infrastruktur database & cache aktif." -ForegroundColor Green

# 2. Periksa apakah Dev Server (Port 4180 / 4100) sudah jalan
Write-Host "`n[2/4] Memeriksa QC Maestro Dev Server..." -ForegroundColor Cyan
$port4180Listening = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", 4180)
    $port4180Listening = $true
    $tcp.Close()
} catch {
    $port4180Listening = $false
}

if (-not $port4180Listening) {
    Write-Host "      Menyalakan Dev Server di background..." -ForegroundColor Yellow
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $RepoRoot -WindowStyle Hidden
} else {
    Write-Host "      Dev Server sudah aktif di port 4180." -ForegroundColor Green
}

# 3. Jalankan Cloudflare Remote Tunnel & WhatsApp Notifier
Write-Host "`n[3/4] Memeriksa Cloudflare Remote Tunnel & WhatsApp Notifier..." -ForegroundColor Cyan
$tunnelProc = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*tunnel-notifier.mjs*" -or $_.CommandLine -like "*cloudflared*tunnel*" 
}

if (-not $tunnelProc) {
    Write-Host "      Menyalakan Tunnel & Bot WhatsApp di background..." -ForegroundColor Yellow
    Start-Process -FilePath "node.exe" -ArgumentList "scripts\tunnel-notifier.mjs" -WorkingDirectory $RepoRoot -WindowStyle Hidden
} else {
    Write-Host "      Tunnel & Bot WhatsApp sudah aktif." -ForegroundColor Green
}

# 4. Jalankan Auto-Update GitHub Watcher
Write-Host "`n[4/4] Memeriksa GitHub Auto-Update Watcher..." -ForegroundColor Cyan
$watcherProc = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*watch-and-deploy.ps1*" -or $_.CommandLine -like "*auto-updater.ps1*" 
}

if (-not $watcherProc) {
    Write-Host "      Menyalakan Auto-Update Watcher di background..." -ForegroundColor Yellow
    $watcherScript = Join-Path $RepoRoot "scripts\watch-and-deploy.ps1"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$watcherScript`"" -WorkingDirectory $RepoRoot -WindowStyle Hidden
} else {
    Write-Host "      Auto-Update Watcher sudah aktif." -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " SEMUA LAYANAN QC MAESTRO BERJALAN PENUH DI BACKGROUND!    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
