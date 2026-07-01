@echo off
echo ========================================
echo   MKT Software - Starting Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    echo.
)

echo [INFO] Starting server...
echo.
echo Server will run at: http://localhost:3000
echo Press Ctrl+C to stop
echo.

node server.js

pause