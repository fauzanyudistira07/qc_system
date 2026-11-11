# ==============================================================================
# QC MAESTRO - DEDICATED DOMAIN TUNNEL: https://timbang.tiraa.my.id
# ==============================================================================
# Skrip ini menjalankan Cloudflare Named Tunnel resmi untuk QC Maestro (Timbang)
# Memetakan domain publik https://timbang.tiraa.my.id langsung ke http://localhost:4180
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "QC Maestro - timbang.tiraa.my.id Tunnel"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$TunnelDir = Join-Path $ProjectRoot "infrastructure\tunnel"
$ConfigFile = Join-Path $TunnelDir "timbang-tunnel.yml"
$CredFile = Join-Path $TunnelDir "a5d738a8-82b1-4304-a7ca-d208a308c5ef.json"
$ToolsDir = Join-Path $ProjectRoot "tools"
$CloudflaredExe = Join-Path $ToolsDir "cloudflared.exe"

Clear-Host
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "        QC MAESTRO - CLOUDFLARE PUBLIC DOMAIN TUNNEL           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Domain Publik  : https://timbang.tiraa.my.id" -ForegroundColor Green
Write-Host " Target Lokal   : http://127.0.0.1:4180 (Web Dashboard)" -ForegroundColor White
Write-Host " Tunnel ID      : a5d738a8-82b1-4304-a7ca-d208a308c5ef (qc-maestro)" -ForegroundColor Gray
Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " ALOKASI PORT BEBAS BENTROK:" -ForegroundColor Yellow
Write-Host "   - QC Maestro (Timbang) : Port 4180 -> https://timbang.tiraa.my.id" -ForegroundColor Green
Write-Host "   - QC Backend API       : Port 4100 (Internal / Proxy)" -ForegroundColor Gray
Write-Host "   - Profesia Web (Laravel): Port 8000 -> https://profesia.tiraa.my.id" -ForegroundColor Cyan
Write-Host "   - Profesia Assets Vite : Port 5173 (Internal dev)" -ForegroundColor Gray
Write-Host "   >>> KEDUA PROYEK TIDAK SALING BERTABRAKAN <<<" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cari binary cloudflared
$Binary = ""
$SystemCloudflared = Get-Command "cloudflared" -ErrorAction SilentlyContinue
if ($SystemCloudflared) {
    $Binary = $SystemCloudflared.Source
} elseif (Test-Path $CloudflaredExe) {
    $Binary = $CloudflaredExe
} else {
    Write-Host "[Tunnel] Mengunduh cloudflared.exe ke folder tools..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    $DownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $CloudflaredExe -UseBasicParsing
        $Binary = $CloudflaredExe
        Write-Host "✅ cloudflared.exe berhasil diunduh!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Gagal mengunduh cloudflared: $_" -ForegroundColor Red
        exit 1
    }
}

# 2. Periksa apakah Web Server 4180 sudah aktif
Write-Host "[1/2] Memeriksa apakah QC Maestro Web Dashboard (port 4180) aktif..." -ForegroundColor Yellow
try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:4180" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) {
        Write-Host "✅ Web Dashboard aktif di http://127.0.0.1:4180!" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Peringatan: Web server port 4180 belum merespons." -ForegroundColor DarkYellow
    Write-Host "   Pastikan 'npm run dev' atau 'scripts\start-server.bat' sudah dijalankan." -ForegroundColor DarkYellow
}

# 3. Jalankan Cloudflare Named Tunnel
Write-Host ""
Write-Host "[2/2] Menghubungkan tunnel ke Cloudflare Edge..." -ForegroundColor Cyan
Write-Host "🌐 Domain https://timbang.tiraa.my.id sedang diaktifkan..." -ForegroundColor Green
Write-Host "Tekan [Ctrl + C] untuk menghentikan tunnel.`n" -ForegroundColor DarkGray

& $Binary tunnel --config "$ConfigFile" --cred-file "$CredFile" run a5d738a8-82b1-4304-a7ca-d208a308c5ef

