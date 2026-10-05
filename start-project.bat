@echo off
setlocal enabledelayedexpansion

echo ===================================================================
echo   Academic Blockchain Consortium - 3-Org PBL System Launcher
echo ===================================================================
echo.
echo [1] Checking Node.js environment...
where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not detected in PATH.
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

:: Install Frontend node_modules if missing
if not exist "%~dp0frontend\node_modules\" (
    echo [2] Installing Frontend dependencies in frontend\...
    pushd "%~dp0frontend"
    call npm.cmd install
    popd
) else (
    echo [2] Frontend node_modules already installed.
)

:: Install Backend node_modules if missing
if not exist "%~dp0backend\node_modules\" (
    echo [3] Installing Backend dependencies in backend\...
    pushd "%~dp0backend"
    call npm.cmd install
    popd
) else (
    echo [3] Backend node_modules already installed.
)

echo.
echo ===================================================================
echo  Starting services in separate terminal windows:
echo   - Backend REST API:  http://localhost:4000/api/health
echo   - Frontend Portal:   http://localhost:3000
echo ===================================================================
echo.

start "Academic Blockchain - Backend API (Port 4000)" cmd /k "cd /d \"%~dp0backend\" && npm.cmd start"
timeout /t 2 /nobreak >nul
start "Academic Blockchain - Frontend Portal (Port 3000)" cmd /k "cd /d \"%~dp0frontend\" && npm.cmd run dev"

echo Services started! Opening browser at http://localhost:3000 in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000
