# ==============================================================================
# QC MAESTRO - AUTONOMOUS GITHUB WEBHOOK TUNNEL (CLOUDFLARE QUICK TUNNEL)
# ==============================================================================
# Skrip ini mengekspos QC Maestro API (port 4100) ke internet secara gratis & aman
# agar GitHub dapat mengirim event push webhook ke laptop server secara otomatis.
# ==============================================================================

$Port = 4100
$ToolsDir = Join-Path $PSScriptRoot "..\tools"
$CloudflaredExe = Join-Path $ToolsDir "cloudflared.exe"

# Cek apakah cloudflared ada di PATH
$SystemCloudflared = Get-Command "cloudflared" -ErrorAction SilentlyContinue

if ($SystemCloudflared) {
    $Binary = $SystemCloudflared.Source
} elseif (Test-Path $CloudflaredExe) {
    $Binary = $CloudflaredExe
} else {
    Write-Host "`n[QC Maestro Tunnel] Mendownload Cloudflare Tunnel (cloudflared.exe)..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    $DownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $CloudflaredExe -UseBasicParsing
        Write-Host "[QC Maestro Tunnel] Berhasil mengunduh cloudflared ke $CloudflaredExe" -ForegroundColor Green
        $Binary = $CloudflaredExe
    } catch {
        Write-Host "[QC Maestro Tunnel] Gagal mengunduh otomatis: $_" -ForegroundColor Red
        Write-Host "Silakan unduh cloudflared secara manual atau gunakan ngrok." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  QC MAESTRO AUTONOMOUS WEBHOOK TUNNEL (PORT $Port)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. Tunggu hingga URL *.trycloudflare.com muncul di bawah."
Write-Host "2. Buka GitHub Repo Proyek -> Settings -> Webhooks -> Add webhook"
Write-Host "3. Payload URL : https://[SUBDOMAIN].trycloudflare.com/api/v1/webhooks/github"
Write-Host "4. Content type: application/json"
Write-Host "5. Events      : Just the push event"
Write-Host "========================================================`n" -ForegroundColor Yellow

& $Binary tunnel --url "http://127.0.0.1:$Port"
