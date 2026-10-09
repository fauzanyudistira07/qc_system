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

            Write-Host "[$Timestamp] Melakukan 'git pull origin $Branch'..." -ForegroundColor Cyan
            git pull origin $Branch

            Write-Host "[$Timestamp] Memperbarui container Docker (docker compose up -d --build)..." -ForegroundColor Cyan
            docker compose up -d --build

            Write-Host "[$Timestamp] SUKSES! Server QC Maestro berhasil diupdate & siap melayani." -ForegroundColor Green
            Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
        }
    }
    catch {
        Write-Warning "Peringatan saat memeriksa pembaruan: $_"
    }

    Start-Sleep -Seconds $IntervalSeconds
}
