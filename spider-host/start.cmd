@echo off
rem Starts the CatVod spider host TVGo talks to. Keep this window open while watching.
rem The app looks for it on http://127.0.0.1:29123 by default (Settings -> Spider 宿主).
setlocal
set HERE=%~dp0
set PORT=%1
if "%PORT%"=="" set PORT=29123
set JAVA=%HERE%..\runtime\jre\bin\java.exe
if not exist "%JAVA%" set JAVA=java
"%JAVA%" -Dtvgo.spider.data="%HERE%..\spider-data" -cp "%HERE%spider-host.jar;%HERE%lib\*" dev.tvgo.spiderhost.Main --serve %PORT%
