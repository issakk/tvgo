# Installs the spider host so TVGo never needs it started by hand: the package is copied to
# %LOCALAPPDATA%\TVGo and a windowless login item (a .vbs in the Startup folder, so no
# console flashes) starts it with javaw.exe at every sign-in. Undo with uninstall.cmd.
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $env:LOCALAPPDATA "TVGo"
$data = Join-Path $target "spider-data"
$port = if ($args.Count -gt 0) { $args[0] } else { "29123" }

Write-Host "复制到 $target"
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Path (Join-Path $here "*") -Destination $target -Recurse -Force

# Both layouts are accepted: the release zip (spider-host\ next to runtime\) and the
# repository's spider-host\ directory (no bundled runtime).
$jar = Join-Path $target "spider-host\spider-host.jar"
if (-not (Test-Path $jar)) { $jar = Join-Path $target "spider-host.jar" }
if (-not (Test-Path $jar)) { throw "找不到 spider-host.jar：请从 TVGo-spider-host-windows.zip 解压后运行 install.cmd" }
$lib = Join-Path (Split-Path -Parent $jar) "lib\*"

$java = Join-Path $target "runtime\jre\bin\javaw.exe"
if (-not (Test-Path $java)) { $java = Join-Path $target "jre\bin\javaw.exe" }
if (-not (Test-Path $java)) {
    $found = Get-Command javaw.exe -ErrorAction SilentlyContinue
    if (-not $found) {
        throw "找不到 javaw.exe：这个压缩包里的 runtime\jre 不完整，请重新下载 TVGo-spider-host-windows.zip"
    }
    $java = $found.Source
    Write-Host "用系统的 javaw.exe：$java"
}

$classpath = '"' + $jar + ";" + $lib + '"'
$command = '"' + $java + '" -Dtvgo.spider.data="' + $data + '" -cp ' + $classpath + " dev.tvgo.spiderhost.Main --serve " + $port

$startup = [Environment]::GetFolderPath("Startup")
$vbs = Join-Path $startup "TVGo Spider Host.vbs"
$line = 'CreateObject("WScript.Shell").Run "' + ($command -replace '"', '""') + '", 0, False'
Set-Content -Path $vbs -Value $line -Encoding Unicode
Write-Host "已加入登录启动：$vbs"

Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $vbs + '"')

$health = "http://127.0.0.1:$port/health"
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $health -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "已启动：$health -> $($response.Content)"
            Write-Host "TVGo -> 设置 -> Spider 宿主 -> 检测，就能看到「已连接」。"
            exit 0
        }
    } catch {
        # Still starting.
    }
}
Write-Warning "已经写入登录启动，但 $health 还没响应；下次登录会自动再试一次。"
