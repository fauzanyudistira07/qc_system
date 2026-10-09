[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "QC Maestro - System Status Monitor"

function Write-StatusItem {
    param(
        [string]$Name,
        [bool]$IsOk,
        [string]$Details = ""
    )
    if ($IsOk) {
        Write-Host " [OK]  " -ForegroundColor Green -NoNewline
        Write-Host "$Name " -ForegroundColor White -NoNewline
        if ($Details) { Write-Host "($Details)" -ForegroundColor Gray } else { Write-Host "" }
    } else {
        Write-Host " [OFF] " -ForegroundColor Red -NoNewline
        Write-Host "$Name " -ForegroundColor Yellow -NoNewline
        if ($Details) { Write-Host "($Details)" -ForegroundColor Red } else { Write-Host "" }
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "         QC MAESTRO - SYSTEM STATUS MONITOR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Waktu Cek : $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss') WIB`n" -ForegroundColor DarkGray

# 1. Docker Engine
$dockerOk = $false
try {
    $info = docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -eq 0 -and $info) { $dockerOk = $true }
} catch {}
Write-StatusItem -Name "Docker Engine" -IsOk $dockerOk -Details $(if ($dockerOk) { "v$info" } else { "Belum aktif / Docker Desktop belum siap" })

# 2. Database & Infra Containers
$infraContainers = @("qc-postgres", "qc-redis", "qc-minio")
$runningContainers = @()
if ($dockerOk) {
    try {
        $ps = docker ps --format '{{.Names}}' 2>$null
        $runningContainers = $ps -split "`n"
    } catch {}
}

$pgOk = $runningContainers -contains "compose-postgres-1" -or $runningContainers -contains "qc-postgres"
$redisOk = $runningContainers -contains "compose-redis-1" -or $runningContainers -contains "qc-redis"
$minioOk = $runningContainers -contains "compose-minio-1" -or $runningContainers -contains "qc-minio"

Write-StatusItem -Name "PostgreSQL (Port 5432)" -IsOk $pgOk -Details $(if ($pgOk) { "Healthy" } else { "Down" })
Write-StatusItem -Name "Redis Cache (Port 6379)" -IsOk $redisOk -Details $(if ($redisOk) { "Running" } else { "Down" })
Write-StatusItem -Name "MinIO S3 (Port 9000/9001)" -IsOk $minioOk -Details $(if ($minioOk) { "Running" } else { "Down" })

# 3. QC Maestro API Server (Port 4100)
$apiOk = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:4100/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.status -eq 'ok') { $apiOk = $true }
} catch {}
Write-StatusItem -Name "QC Maestro API (Port 4100)" -IsOk $apiOk -Details $(if ($apiOk) { "http://127.0.0.1:4100 - Healthy" } else { "Tidak merespons" })

# 4. Web Dashboard (Port 4180)
$webOk = $false
try {
    $resWeb = Invoke-WebRequest -Uri "http://127.0.0.1:4180" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($resWeb.StatusCode -eq 200) { $webOk = $true }
} catch {}
Write-StatusItem -Name "Web Dashboard UI (Port 4180)" -IsOk $webOk -Details $(if ($webOk) { "http://127.0.0.1:4180 - Ready" } else { "Tidak merespons" })

# 5. Cloudflare Tunnel
$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue
$tunnelOk = ($tunnelProc -ne $null)
$tunnelUrl = ""
$urlFile = Join-Path $PSScriptRoot "..\active-tunnel-url.txt"
if (Test-Path $urlFile) {
    $tunnelUrl = (Get-Content $urlFile -Raw).Trim()
}
Write-StatusItem -Name "Cloudflare Remote Tunnel" -IsOk $tunnelOk -Details $(if ($tunnelOk) { "Active (PID: $($tunnelProc.Id))" } else { "Tidak berjalan" })

# 6. Auto-Update Watcher
$watcherProc = Get-WmiObject Win32_Process | Where-Object { 
    $_.CommandLine -like "*watch-and-deploy.ps1*" -or $_.CommandLine -like "*auto-updater.ps1*" 
}
$watcherOk = ($watcherProc -ne $null)
Write-StatusItem -Name "GitHub Auto-Update Watcher" -IsOk $watcherOk -Details $(if ($watcherOk) { "Running (Active)" } else { "Standby / Off" })

Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " TAUTAN AKSES AKTIF SAAT INI:" -ForegroundColor White
if ($tunnelUrl -and $tunnelOk) {
    Write-Host " [INTERNET] " -ForegroundColor Cyan -NoNewline
    Write-Host "$tunnelUrl" -ForegroundColor Yellow
} else {
    Write-Host " [INTERNET] " -ForegroundColor Red -NoNewline
    Write-Host "Tunnel belum terhubung ke internet" -ForegroundColor Gray
}

# Dapatkan IP Lokal Wi-Fi
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*Wi-Fi*","*Ethernet*" -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -ExpandProperty IPAddress -First 1)
if (-not $localIp) { $localIp = "127.0.0.1" }
Write-Host " [LOKAL LAN] " -ForegroundColor Green -NoNewline
Write-Host "http://${localIp}:4180" -ForegroundColor White
Write-Host "========================================================`n" -ForegroundColor Cyan
