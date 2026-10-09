# Script PowerShell untuk menghapus QC Maestro dari Windows Startup
$startupFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$shortcutPath = Join-Path $startupFolder "QCMaestroServer.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "[BERHASIL] Shortcut Auto-Start telah dihapus dari folder Startup." -ForegroundColor Green
    Write-Host "Lokasi yang dihapus: $shortcutPath" -ForegroundColor Gray
} else {
    Write-Host "[INFO] Shortcut Auto-Start tidak ditemukan di folder Startup." -ForegroundColor Yellow
}
