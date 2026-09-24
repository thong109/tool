@echo off
echo ========================================
echo   FFmpeg Auto Installer for Windows
echo ========================================
echo.

setlocal enabledelayedexpansion

echo [1/5] Checking administrator privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run this script as Administrator!
    echo Right-click on this file and select "Run as administrator"
    pause
    exit /b 1
)

echo ✓ Running as Administrator
echo.

echo [2/5] Creating directories...
if not exist "C:\ffmpeg" mkdir C:\ffmpeg
echo ✓ Created C:\ffmpeg
echo.

echo [3/5] Downloading FFmpeg...
echo This may take a few minutes depending on your internet speed...
echo.

set "FFMPEG_URL=https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
set "DOWNLOAD_PATH=%TEMP%\ffmpeg.zip"

echo Downloading from: %FFMPEG_URL%
echo.

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%FFMPEG_URL%' -OutFile '%DOWNLOAD_PATH%' -UseBasicParsing}"

if not exist "%DOWNLOAD_PATH%" (
    echo ERROR: Download failed!
    pause
    exit /b 1
)

echo ✓ Download completed
echo.

echo [4/5] Extracting FFmpeg...
echo This may take a minute...
echo.

powershell -Command "Expand-Archive -Path '%DOWNLOAD_PATH%' -DestinationPath 'C:\ffmpeg' -Force"

echo ✓ Extraction completed
echo.

echo [5/5] Configuring PATH...
echo.

REM Find the extracted folder (it usually has a version number in the name)
for /d %%d in (C:\ffmpeg\ffmpeg-*) do (
    set "FFMPEG_BIN=%%d\bin"
    goto :found_ffmpeg
)

echo ERROR: Could not find FFmpeg bin folder!
pause
exit /b 1

:found_ffmpeg
echo Found FFmpeg at: %FFMPEG_BIN%

REM Add to system PATH
echo Adding to PATH...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\ffmpeg\bin', 'Machine')"

echo ✓ Added to system PATH
echo.

echo [6/5] Cleaning up...
del "%DOWNLOAD_PATH%"
echo ✓ Cleaned up temporary files
echo.

echo ========================================
echo   Installation Completed!
echo ========================================
echo.
echo FFmpeg has been installed to: C:\ffmpeg
echo.
echo IMPORTANT: You need to RESTART your terminal/computer for the changes to take effect!
echo.
echo After restart, verify installation by running:
echo   ffmpeg -version
echo   ffprobe -version
echo.
echo Then restart your server:
echo   node server.js
echo.

pause