# QC Maestro - Master Start Script
# Menyalakan Docker, Database, Redis, MinIO, API Fastify, Web Dashboard, dan membuka Browser.

param (
    [switch]$NoBrowser
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

function Print-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host "            QC MAESTRO - AUTONOMOUS QA PLATFORM" -ForegroundColor Cyan
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host "   Waktu Mulai : $(Get-Date -Format 'dd MMMM yyyy HH:mm:ss') WIB" -ForegroundColor Gray
    Write-Host "   Lokasi      : $ProjectRoot" -ForegroundColor Gray
    Write-Host "  ----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

Print-Banner

# ---------------------------------------------------------
# 1. PERIKSA & NYALAKAN DOCKER DESKTOP
# ---------------------------------------------------------
Write-Host "🔍 [1/5] Memeriksa status Docker Engine..." -ForegroundColor Yellow

$dockerRunning = $false
try {
    $dockerInfo = & docker info --format '{{.ServerVersion}}' 2>$null
    if ($LASTEXITCODE -eq 0 -and $dockerInfo) {
        $dockerRunning = $true
        Write-Host "   ✅ Docker Engine sudah aktif (versi $dockerInfo)." -ForegroundColor Green
    }
} catch {}

if (-not $dockerRunning) {
    Write-Host "   ⚠️ Docker Engine belum aktif. Memulai Docker Desktop..." -ForegroundColor Yellow
    $dockerPaths = @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
        "C:\Program Files\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\Docker desktop.exe"
    )
    
    $dockerStarted = $false
    foreach ($p in $dockerPaths) {
        if (Test-Path $p) {
            Start-Process -FilePath $p
            $dockerStarted = $true
            Write-Host "   🚀 Menjalankan: $p" -ForegroundColor Gray
            break
        }
    }
    
    if (-not $dockerStarted) {
        $backendPath = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\com.docker.backend.exe"
        if (Test-Path $backendPath) {
            Start-Process -FilePath $backendPath -WindowStyle Hidden
            $dockerStarted = $true
            Write-Host "   🚀 Menjalankan Docker Backend service..." -ForegroundColor Gray
        }
    }

    if ($dockerStarted) {
        Write-Host "   ⏳ Menunggu Docker Engine siap digunakan..." -NoNewline -ForegroundColor Yellow
        $timeout = 60
        $elapsed = 0
        while ($elapsed -lt $timeout) {
            Start-Sleep -Seconds 2
            $elapsed += 2
            Write-Host "." -NoNewline -ForegroundColor Yellow
            try {
                $check = & docker info --format '{{.ServerVersion}}' 2>$null
                if ($LASTEXITCODE -eq 0 -and $check) {
                    $dockerRunning = $true
                    Write-Host ""
                    Write-Host "   ✅ Docker Engine siap (versi $check)!" -ForegroundColor Green
                    break
                }
            } catch {}
        }
        if (-not $dockerRunning) {
            Write-Host ""
            Write-Host "   ⚠️ Docker memakan waktu lama untuk siap. Melanjutkan service aplikasi..." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "   ⚠️ File instalasi Docker Desktop tidak ditemukan. Melewati langkah Docker..." -ForegroundColor DarkYellow
    }
}

# ---------------------------------------------------------
# 2. NYALAKAN INFRASTRUKTUR DOCKER (DATABASE, REDIS, MINIO)
# ---------------------------------------------------------
if ($dockerRunning) {
    Write-Host ""
    Write-Host "📦 [2/5] Menyalakan infrastruktur database (PostgreSQL, Redis, MinIO)..." -ForegroundColor Yellow
    $composeFile = Join-Path $ProjectRoot "infrastructure\compose\docker-compose.yml"
    
    if (Test-Path $composeFile) {
        & docker compose -f $composeFile up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Kontainer infrastruktur berhasil dinyalakan." -ForegroundColor Green
            Write-Host "      - PostgreSQL: localhost:5432 (db: qc_maestro, user: qc)" -ForegroundColor Gray
            Write-Host "      - Redis     : localhost:6379" -ForegroundColor Gray
            Write-Host "      - MinIO     : localhost:9000 (Console: http://localhost:9001)" -ForegroundColor Gray
        } else {
            Write-Host "   ⚠️ Gagal menjalankan docker compose. Melanjutkan dengan storage file lokal..." -ForegroundColor DarkYellow
        }
    }
} else {
    Write-Host ""
    Write-Host "ℹ️ [2/5] Docker tidak aktif. QC Maestro akan beroperasi menggunakan penyimpanan lokal (.qc-artifacts)." -ForegroundColor Gray
}

# ---------------------------------------------------------
# 3. PERSIAPKAN PORT & BERSIHKAN PROSES LAMA
# ---------------------------------------------------------
Write-Host ""
Write-Host "🧹 [3/5] Memastikan port 4100 (API) dan 4180 (Web) bersih..." -ForegroundColor Yellow

$busyConnections = Get-NetTCPConnection -LocalPort 4100, 4180 -ErrorAction SilentlyContinue
if ($busyConnections) {
    foreach ($conn in $busyConnections) {
        $pId = $conn.OwningProcess
        if ($pId -gt 0 -and $pId -ne $PID) {
            try {
                Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue
                Write-Host "   Killed process $pId on port $($conn.LocalPort)" -ForegroundColor DarkGray
            } catch {}
        }
    }
}
Write-Host "   ✅ Port siap digunakan." -ForegroundColor Green

# ---------------------------------------------------------
# 4. MONITOR PEMBUKA BROWSER OTOMATIS
# ---------------------------------------------------------
Write-Host ""
Write-Host "🌐 [4/5] Menyiapkan browser auto-launcher..." -ForegroundColor Yellow

if (-not $NoBrowser) {
    $browserJob = Start-Job -ScriptBlock {
        $apiOk = $false
        $webOk = $false
        $start = Get-Date

        while (-not ($apiOk -and $webOk) -and ((Get-Date) - $start).TotalSeconds -lt 45) {
            Start-Sleep -Seconds 1
            if (-not $apiOk) {
                try {
                    $res = Invoke-RestMethod -Uri "http://127.0.0.1:4100/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
                    if ($res.status -eq 'ok') { $apiOk = $true }
                } catch {}
            }
            if (-not $webOk) {
                try {
                    $resWeb = Invoke-WebRequest -Uri "http://127.0.0.1:4180" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                    if ($resWeb.StatusCode -eq 200) { $webOk = $true }
                } catch {}
            }
        }

        if ($webOk) {
            Start-Process "http://localhost:4180"
        }
    }
    Write-Host "   ✅ Browser akan terbuka otomatis ke http://localhost:4180 setelah web siap." -ForegroundColor Green
}

# ---------------------------------------------------------
# 5. MENJALANKAN DEV SERVERS (API + WEB)
# ---------------------------------------------------------
Write-Host ""
Write-Host "⚡ [5/5] Memulai QC Maestro API & Web Dashboard..." -ForegroundColor Cyan
Write-Host "  ================================================================" -ForegroundColor DarkGray
Write-Host "   🌍 Web Dashboard : http://localhost:4180" -ForegroundColor Green
Write-Host "   🔌 Backend API   : http://localhost:4100" -ForegroundColor Green
Write-Host "   🔑 Login Admin   : admin@qcmaestro.com / admin12345" -ForegroundColor Yellow
Write-Host "   🛑 Cara Berhenti : Tekan Ctrl + C pada jendela ini" -ForegroundColor Magenta
Write-Host "  ================================================================" -ForegroundColor DarkGray
Write-Host ""

# Jalankan server
try {
    npm run dev
} finally {
    Write-Host ""
    Write-Host "🛑 Menutup layanan QC Maestro..." -ForegroundColor Yellow
    if ($browserJob) {
        Stop-Job $browserJob -ErrorAction SilentlyContinue
        Remove-Job $browserJob -ErrorAction SilentlyContinue
    }
}
