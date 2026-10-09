# Script PowerShell untuk mendaftarkan QC Maestro ke Windows Startup
$ErrorActionPreference = "Stop"

try {
    $scriptDir = $PSScriptRoot
    $vbsPath = Join-Path $scriptDir "run-hidden.vbs"

    if (-not (Test-Path $vbsPath)) {
        Write-Host "[ERROR] File run-hidden.vbs tidak ditemukan di: $vbsPath" -ForegroundColor Red
        exit 1
    }

    $ws = New-Object -ComObject WScript.Shell
    $startupFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
    $shortcutPath = Join-Path $startupFolder "QCMaestroServer.lnk"

    $sc = $ws.CreateShortcut($shortcutPath)
    $sc.TargetPath = "wscript.exe"
    $sc.Arguments = "`"$vbsPath`""
    $sc.WorkingDirectory = $scriptDir
    $sc.Description = "QC Maestro Auto-Start Docker and GitHub Watcher"
    $sc.Save()

    Write-Host "[BERHASIL] Shortcut Auto-Start dibuat!" -ForegroundColor Green
    Write-Host "Lokasi File : $shortcutPath" -ForegroundColor Cyan
    Write-Host "Target      : wscript.exe `"$vbsPath`"`n" -ForegroundColor Gray
} catch {
    Write-Host "[GAGAL] Terjadi kesalahan: $_" -ForegroundColor Red
    exit 1
}
