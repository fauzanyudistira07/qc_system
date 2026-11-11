# Auto Update & Redeploy Worker for QC Maestro Server
# Mengecek pembaruan GitHub setiap 30 detik secara otomatis.

param (
    [int]$IntervalSeconds = 30,
    [string]$Branch = "main"
)

$Host.UI.RawUI.WindowTitle = "QC Maestro - Auto Update Watcher"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " QC MAESTRO SERVER - GITHUB AUTO-UPDATE WATCHER" -ForegroundColor Yellow
Write-Host " Memantau branch '$Branch' setiap $IntervalSeconds detik..." -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

$RepoDir = Split-Path -Parent $PSScriptRoot
Set-Location $RepoDir

while ($true) {
    try {
        # Ambil status remote terbaru tanpa mengubah local working tree
        git fetch origin $Branch 2>$null

        $LocalHash = (git rev-parse HEAD).Trim()
        $RemoteHash = (git rev-parse "origin/$Branch").Trim()

        if ($LocalHash -ne $RemoteHash) {
            $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            Write-Host "[$Timestamp] Terdeteksi commit baru di GitHub!" -ForegroundColor Yellow
            Write-Host "Local : $LocalHash" -ForegroundColor DarkGray
            Write-Host "Remote: $RemoteHash" -ForegroundColor DarkGray

            Write-Host "[$Timestamp] Membersihkan perubahan lokal sementara & sinkronisasi..." -ForegroundColor Cyan
            git checkout -- . 2>$null
            git clean -fd -e ".qc-artifacts" 2>$null

            Write-Host "[$Timestamp] Melakukan 'git pull origin $Branch'..." -ForegroundColor Cyan
            git pull origin $Branch
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[$Timestamp] [WARNING] git pull bentrok, melakukan reset paksa ke origin/$Branch..." -ForegroundColor Yellow
                git reset --hard "origin/$Branch"
            }

            Write-Host "[$Timestamp] Memastikan runtime browser Playwright terpasang..." -ForegroundColor Cyan
            npx playwright install chromium 2>$null

            Write-Host "[$Timestamp] Memperbarui container Docker (docker compose up -d --build)..." -ForegroundColor Cyan
            docker compose up -d --build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[$Timestamp] [ERROR] docker compose up gagal! Cek konflik port (4100/4180/6379)." -ForegroundColor Red
                node "scripts\notify-deploy-wa.mjs" --sha "$RemoteHash" --msg "Gagal start container Docker (konflik port/build error)" --status "failed" 2>$null
                continue
            }

            Write-Host "[$Timestamp] SUKSES! Server QC Maestro berhasil diupdate & siap melayani." -ForegroundColor Green
            Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray

            # Kirim notifikasi WhatsApp via Fonnte
            $author = (git log -1 --pretty=format:"%an" origin/$Branch 2>$null).Trim()
            $cleanMsg = (git log -1 --pretty=format:"%s" origin/$Branch 2>$null).Trim()
            node "scripts\notify-deploy-wa.mjs" --sha "$RemoteHash" --msg "$cleanMsg" --author "$author" --status "success"
        }
    }
    catch {
        Write-Warning "Peringatan saat memeriksa pembaruan: $_"
        node "scripts\notify-deploy-wa.mjs" --sha "$RemoteHash" --msg "Error pada watcher" --status "failed" --details "$_"
    }

    Start-Sleep -Seconds $IntervalSeconds
}
