@echo off
echo ========================================
echo   MKT Software - Complete Setup
echo ========================================
echo.

setlocal enabledelayedexpansion

echo This script will:
echo   1. Install Node.js dependencies
echo   2. Install FFmpeg automatically
echo   3. Verify installation
echo.

echo [Step 1/3] Installing Node.js dependencies...
echo.

if not exist "node_modules" (
    echo node_modules not found. Running npm install...
    call npm install
) else (
    echo ✓ node_modules already exists
    echo Checking for updates...
    call npm update
)

if %errorLevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo ✓ Node.js dependencies installed
echo.

echo [Step 2/3] Installing FFmpeg...
echo.

REM Check if FFmpeg is already installed
ffmpeg -version >nul 2>&1
if %errorLevel% equ 0 (
    echo ✓ FFmpeg is already installed!
    ffmpeg -version | findstr "ffmpeg version"
    echo.
    echo Skipping FFmpeg installation...
) else (
    echo FFmpeg not found. Starting installation...
    echo.
    
    REM Check if install-ffmpeg.bat exists
    if not exist "install-ffmpeg.bat" (
        echo ERROR: install-ffmpeg.bat not found!
        echo Please make sure you're running this from the project directory.
        pause
        exit /b 1
    )
    
    REM Run FFmpeg installer
    call install-ffmpeg.bat
    
    if %errorLevel% neq 0 (
        echo ERROR: FFmpeg installation failed!
        pause
        exit /b 1
    )
)

echo.
echo [Step 3/3] Verifying installation...
echo.

echo Checking Node.js...
node --version
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed!
    pause
    exit /b 1
)
echo ✓ Node.js is installed
echo.

echo Checking npm...
npm --version
if %errorLevel% neq 0 (
    echo ERROR: npm is not installed!
    pause
    exit /b 1
)
echo ✓ npm is installed
echo.

echo Checking FFmpeg...
ffmpeg -version >nul 2>&1
if %errorLevel% equ 0 (
    ffmpeg -version | findstr "ffmpeg version"
    echo ✓ FFmpeg is installed
) else (
    echo WARNING: FFmpeg not found in PATH
    echo You may need to restart your terminal
)
echo.

echo Checking FFprobe...
ffprobe -version >nul 2>&1
if %errorLevel% equ 0 (
    ffprobe -version | findstr "ffprobe version"
    echo ✓ FFprobe is installed
) else (
    echo WARNING: FFprobe not found in PATH
)
echo.

echo ========================================
echo   Setup Completed!
echo ========================================
echo.
echo Next steps:
echo   1. Restart your terminal (if FFmpeg was just installed)
echo   2. Run: node server.js
echo   3. Open: http://localhost:3000/video-cutter-wasm.html
echo.
echo For more information, see HOW_TO_RUN.md
echo.

pause