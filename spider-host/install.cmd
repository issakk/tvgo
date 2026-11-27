@echo off
rem One click: copy the host to %LOCALAPPDATA%\TVGo, start it without a window, and make it
rem start again at every sign-in. Undo with uninstall.cmd.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-autostart.ps1" %*
echo.
pause
