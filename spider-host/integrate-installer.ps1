# Folds the spider host into the Windows package `nsh package` produced: copies the staged
# runtime + host next to TVGo.exe, adds the two installer entries that make it invisible (a
# login item so it starts with Windows, and a first start right after installing), and
# recompiles the installer with Inno Setup.
#
# `nsh package` writes the .iss and compiles it; this script edits that script in place
# (adding entries to the sections it has, never a second copy of a section) and runs ISCC.
param(
    [Parameter(Mandatory = $true)] [string] $PackageDir,
    [Parameter(Mandatory = $true)] [string] $Script,
    [Parameter(Mandatory = $true)] [string] $HostStage,
    [Parameter(Mandatory = $true)] [string] $Zip
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $PackageDir)) { throw "package directory not found: $PackageDir" }
if (-not (Test-Path $Script)) { throw "installer script not found: $Script" }
if (-not (Test-Path $HostStage)) { throw "spider host staging not found: $HostStage" }

Write-Host "copying the spider host into $PackageDir"
Copy-Item -Path (Join-Path $HostStage "*") -Destination $PackageDir -Recurse -Force

# The same command line the login item and the first start use. In Inno's script `"` inside a
# string is `""`, and `{` starts a constant, so a literal brace would have to be doubled.
$arguments = '"-Dtvgo.spider.data=""{localappdata}\TVGo\spider-data"" ' +
    '-cp ""{app}\spider-host\spider-host.jar;{app}\spider-host\lib\*"" ' +
    'dev.tvgo.spiderhost.Main --serve 29123"'
$javaw = '{app}\runtime\jre\bin\javaw.exe'

$loginItem = 'Name: "{userstartup}\TVGo Spider Host"; Filename: "' + $javaw + '"; ' +
    'Parameters: ' + $arguments + '; WorkingDir: "{app}"; Comment: "TVGo spider host"; ' +
    'Flags: createonlyiffileexists'
$firstStart = 'Filename: "' + $javaw + '"; Parameters: ' + $arguments + '; ' +
    'Flags: nowait runhidden skipifsilent'
$stopHost = 'Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass ' +
    '-File ""{app}\spider-host\stop-host.ps1"""; Flags: runhidden waituntilterminated skipifdoesntexist'
$removeItem = 'Type: files; Name: "{userstartup}\TVGo Spider Host.lnk"'

$lines = Get-Content -Path $Script
$out = New-Object System.Collections.Generic.List[string]
$sawIcons = $false
$sawRun = $false
$sawUninstallDelete = $false
foreach ($line in $lines) {
    $out.Add($line)
    $trimmed = $line.Trim()
    if ($trimmed -eq "[Icons]") {
        $sawIcons = $true
        $out.Add($loginItem)
    } elseif ($trimmed -eq "[Run]") {
        $sawRun = $true
        $out.Add($firstStart)
    } elseif ($trimmed -eq "[UninstallDelete]") {
        $sawUninstallDelete = $true
        $out.Add($removeItem)
    }
}
if (-not $sawIcons) { $out.Add(""); $out.Add("[Icons]"); $out.Add($loginItem) }
if (-not $sawRun) { $out.Add(""); $out.Add("[Run]"); $out.Add($firstStart) }
if (-not $sawUninstallDelete) {
    $out.Add("")
    $out.Add("[UninstallDelete]")
    $out.Add($removeItem)
}
$out.Add("")
$out.Add("[UninstallRun]")
$out.Add($stopHost)
Set-Content -Path $Script -Value $out -Encoding UTF8
Write-Host "patched $Script"

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe")
    )
    $iscc = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $iscc) { throw "ISCC.exe not found: install Inno Setup 6" }

$outDir = Split-Path -Parent $Script
& $iscc /Q "/O$outDir" $Script
if ($LASTEXITCODE -ne 0) { throw "ISCC failed with exit code $LASTEXITCODE" }
Write-Host "rebuilt the installer with the spider host"

# `nsh package` zipped the directory before the host was in it.
Remove-Item -Path $Zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $Zip -Force
Write-Host "repacked $Zip"
