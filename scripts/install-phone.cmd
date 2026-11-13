@echo off
setlocal
rem Builds Tally, installs it on the USB-connected phone, and opens it. Log: scripts\install-phone.log
cd /d "%~dp0.."
set "LOG=%CD%\scripts\install-phone.log"
echo [%date% %time%] Starting Tally build > "%LOG%"

if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" set "ADB=adb"

echo == Connected devices ==>> "%LOG%"
"%ADB%" devices >> "%LOG%" 2>&1

echo == Web build + Capacitor sync ==>> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-android.ps1 >> "%LOG%" 2>&1
if errorlevel 1 goto fail

echo == Gradle installDebug ==>> "%LOG%"
pushd apps\paygauge-web\android
call gradlew.bat installDebug >> "%LOG%" 2>&1
set "GRADLE_RESULT=%ERRORLEVEL%"
popd
if not "%GRADLE_RESULT%"=="0" goto fail

echo == Launching Tally ==>> "%LOG%"
"%ADB%" shell am start -n app.paygauge.mobile/.MainActivity >> "%LOG%" 2>&1
echo [%date% %time%] SUCCESS >> "%LOG%"
echo.
echo Tally is installed and open on your phone.
timeout /t 8
exit /b 0

:fail
echo [%date% %time%] FAILED >> "%LOG%"
echo.
echo Build failed. See scripts\install-phone.log
pause
exit /b 1
