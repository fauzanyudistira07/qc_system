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

            # 2. Pastikan kontainer infrastruktur tetap sehat
            Write-Host "`n[2/3] Memastikan kontainer database & cache aktif..." -ForegroundColor Cyan
            docker compose -f infrastructure\compose\docker-compose.yml up -d
            Write-Host "`n[SUCCESS] Server QC Maestro berhasil diperbarui ke commit terbaru ($remoteSha)!" -ForegroundColor Green
            Write-Host "Perubahan kode langsung aktif via hot-reload dev server.`n" -ForegroundColor Green

            # 3. Kirim notifikasi WhatsApp
            Write-Host "[3/3] Mengirim konfirmasi pembaruan ke WhatsApp..." -ForegroundColor Cyan
            $author = (git log -1 --pretty=format:"%an" origin/main 2>$null).Trim()
            $cleanMsg = (git log -1 --pretty=format:"%s" origin/main 2>$null).Trim()
            node "scripts\notify-deploy-wa.mjs" --sha "$remoteSha" --msg "$cleanMsg" --author "$author" --status "success"
        } else {
            # Idle heartbeat
            $timeNow = (Get-Date).ToString("HH:mm:ss")
            Write-Host -NoNewline "`r[$timeNow] Sinkron dengan GitHub (Commit: $($localSha.Substring(0,7))). Menunggu push baru..."
        }
    }
    catch {
        Write-Host "`n[ERROR] Terjadi kendala saat memeriksa update: $_" -ForegroundColor Red
        node "scripts\notify-deploy-wa.mjs" --sha "$remoteSha" --msg "$commitMsg" --status "failed" --details "$_"
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}
