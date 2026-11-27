# Undoes install-autostart.ps1: removes the login item, stops the running host, deletes the
# installed files. The cache in %LOCALAPPDATA%\TVGo\spider-data stays, so nothing is
# downloaded or converted again after a reinstall.
$ErrorActionPreference = "Continue"

$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "TVGo Spider Host.vbs"
if (Test-Path $vbs) {
    Remove-Item -Path $vbs -Force
    Write-Host "已移除登录启动：$vbs"
}

Get-CimInstance Win32_Process -Filter "Name='javaw.exe' or Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*dev.tvgo.spiderhost.Main*" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "已停止宿主进程 $($_.ProcessId)"
    }

$target = Join-Path $env:LOCALAPPDATA "TVGo\spider-host"
if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
    Write-Host "已删除 $target（缓存 spider-data 保留）"
}
