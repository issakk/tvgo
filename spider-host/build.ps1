# Builds build/spider-host.jar on Windows (the CI runner), as build.sh does: the vendored
# jars stay separate and are put on the classpath by start.cmd.
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$apiJar = Join-Path $here "vendor\android-api.jar"
if (-not (Test-Path $apiJar)) {
    $url = "https://repo1.maven.org/maven2/com/google/android/android/4.1.1.4/android-4.1.1.4.jar"
    Write-Host "downloading $url"
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $apiJar
}

$out = Join-Path $here "build"
$classes = Join-Path $out "classes"
Remove-Item -Recurse -Force $classes -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes | Out-Null

$classpath = ((Get-ChildItem -Path (Join-Path $here "vendor") -Filter *.jar) |
    ForEach-Object { $_.FullName }) -join [IO.Path]::PathSeparator
$sources = Get-ChildItem -Path (Join-Path $here "src\main\java") -Filter *.java -Recurse |
    ForEach-Object { $_.FullName }
& javac -nowarn -encoding UTF-8 -cp $classpath -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }

$jarPath = Join-Path $out "spider-host.jar"
Remove-Item -Force $jarPath -ErrorAction SilentlyContinue
& jar --create --file $jarPath --main-class dev.tvgo.spiderhost.Main -C $classes .
if ($LASTEXITCODE -ne 0) { throw "jar failed with exit code $LASTEXITCODE" }

Write-Host "built $jarPath"
