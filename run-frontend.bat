@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo   Academic Blockchain Portal - Frontend Launcher
echo =========================================================
echo.

cd /d "%~dp0frontend"

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
    echo [INFO] node_modules not found in frontend directory.
    echo [INFO] Installing frontend dependencies...
    echo.
    call npm.cmd install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] npm install failed. Please inspect the output above.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed successfully!
    echo.
)

echo [INFO] Starting Frontend with Vite Dev Server...
echo [INFO] Portal will be accessible at: http://localhost:3000
echo.
call npm.cmd run dev
pause
