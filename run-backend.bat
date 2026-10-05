@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo   Academic Blockchain Portal - Backend Launcher
echo =========================================================
echo.

cd /d "%~dp0backend"

:: Check if node is installed
where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] node_modules not found in backend directory.
    echo [INFO] Installing backend dependencies...
    echo.
    call npm.cmd install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] npm install failed in backend. Please inspect output above.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Backend dependencies installed!
    echo.
)

echo [INFO] Starting Backend REST API on port 4000...
echo [INFO] Health endpoint: http://localhost:4000/api/health
echo.
call npm.cmd start
pause
