@echo off
cd /d "%~dp0"
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm.cmd install
)
echo Starting Vite dev server on http://localhost:3000...
call npm.cmd run dev
pause
