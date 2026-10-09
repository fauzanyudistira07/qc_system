# QC Maestro - Continuous Deployment Watcher for Windows Server
# Otomatis mendeteksi push baru di GitHub, melakukan git pull, dan update container Docker.

$CheckIntervalSeconds = 20
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  QC MAESTRO - AUTO DEPLOYMENT WATCHER (ACTIVE)           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Lokasi Repo   : $RepoRoot" -ForegroundColor Gray
Write-Host "Interval Cek  : Setiap $CheckIntervalSeconds detik" -ForegroundColor Gray
Write-Host "Branch Target : main" -ForegroundColor Gray
Write-Host "Tekan [Ctrl + C] kapan saja untuk menghentikan daemon.`n" -ForegroundColor Yellow

Set-Location $RepoRoot

# Verifikasi git repositori
$currentBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ($currentBranch -ne "main") {
    Write-Host "[WARNING] Branch aktif saat ini adalah '$currentBranch'. Berpindah ke 'main'..." -ForegroundColor Yellow
    git checkout main
}

while ($true) {
    try {
        # Fetch remote update tanpa mengubah file lokal
        git fetch origin main --quiet 2>$null

        $localSha = (git rev-parse HEAD 2>$null).Trim()
        $remoteSha = (git rev-parse origin/main 2>$null).Trim()

        if ($localSha -ne "" -and $remoteSha -ne "" -and $localSha -ne $remoteSha) {
            $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            $commitMsg = (git log -1 --pretty=format:"%s (%an)" origin/main 2>$null).Trim()

            Write-Host "`n[$timestamp] >>> COMMIT BARU TERDETEKSI DI GITHUB! <<<" -ForegroundColor Green
            Write-Host "Commit SHA   : $localSha -> $remoteSha" -ForegroundColor White
            Write-Host "Pesan Commit : $commitMsg" -ForegroundColor Yellow
            Write-Host "Menjalankan update sistem..." -ForegroundColor Cyan

            # 1. Pull update
            Write-Host "`n[1/2] Melakukan git pull origin main..." -ForegroundColor Cyan
            git pull origin main

            # 2. Rebuild & Restart Docker Containers
            Write-Host "`n[2/2] Memperbarui container Docker (docker compose up -d --build)..." -ForegroundColor Cyan
            docker compose up -d --build

            Write-Host "`n[SUCCESS] Server QC Maestro berhasil diperbarui ke commit terbaru ($remoteSha)!" -ForegroundColor Green
            Write-Host "Kontainer web & API sudah live dengan kode teranyar.`n" -ForegroundColor Green
        } else {
            # Idle heartbeat
            $timeNow = (Get-Date).ToString("HH:mm:ss")
            Write-Host -NoNewline "`r[$timeNow] Sinkron dengan GitHub (Commit: $($localSha.Substring(0,7))). Menunggu push baru..."
        }
    }
    catch {
        Write-Host "`n[ERROR] Terjadi kendala saat memeriksa update: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}
