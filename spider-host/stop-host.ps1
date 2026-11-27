# Stops a running spider host: the one this installation started at login, or one a user
# started by hand. Used by the uninstaller, so it must not fail when nothing runs.
Get-CimInstance Win32_Process -Filter "Name='javaw.exe' or Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*dev.tvgo.spiderhost.Main*" } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
exit 0
