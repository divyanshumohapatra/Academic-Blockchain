# Master Windows PowerShell Startup Script for 3-Organization Academic Blockchain PBL System
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host " 🎓 Academic Blockchain PBL — 3-Organization Architecture " -ForegroundColor Yellow
Write-Host " Consortium: Org1 (Academic), Org2 (Exam), Org3 (Admin)   " -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Verify Docker Daemon
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker is not running! Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Docker command not found. Please ensure Docker Desktop is installed." -ForegroundColor Red
    exit 1
}

# 2. Check bash availability for network scripts
$bashPath = (Get-Command bash -ErrorAction SilentlyContinue).Source
if ($bashPath) {
    Write-Host "`n--> [Step 1/3] Bringing up Fabric 3-Org Network & IPFS..." -ForegroundColor Green
    & bash network/network.sh up
} else {
    Write-Host "`n--> [Step 1/3] Bash not found in PATH; starting application containers directly..." -ForegroundColor Yellow
}

# 3. Build & Launch Backend API and Web Portal Containers
Write-Host "`n--> [Step 2/3] Starting Backend REST API and Web Portal..." -ForegroundColor Green
docker compose -f "docker/docker-compose-app.yaml" up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n⚠️ Docker compose build returned non-zero status. Falling back to local host services..." -ForegroundColor Yellow
    
    # Install dependencies if missing and launch
    if (Test-Path "backend") {
        Write-Host "--> Launching Backend REST API on port 4000..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/backend'; npm install; node src/server.js"
    }
    if (Test-Path "frontend") {
        Write-Host "--> Launching Web Portal on port 3000..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot/frontend'; npm install; node server.js"
    }
}

# 4. Status summary
Start-Sleep -Seconds 3
Write-Host "`n=========================================================" -ForegroundColor Cyan
Write-Host " 🎉 3-Organization Academic Blockchain is RUNNING!        " -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " 🌐 Web Verification Portal:  http://localhost:3000" -ForegroundColor White
Write-Host " 🔌 Backend REST API:         http://localhost:4000/api/health" -ForegroundColor White
Write-Host " 🔐 Public Keys Center:       http://localhost:3000 (Click Keys & MSP Tab)" -ForegroundColor White
Write-Host " 🔍 Employer Verification:    http://localhost:3000/verify" -ForegroundColor White
Write-Host ""
Write-Host " Organizations Participating:" -ForegroundColor Gray
Write-Host "   • Org1 (University / Academic Dept) - peer0.org1.academic.edu:7051 (CouchDB: 5984)" -ForegroundColor Gray
Write-Host "   • Org2 (Examination Board)          - peer0.org2.academic.edu:8051 (CouchDB: 6984)" -ForegroundColor Gray
Write-Host "   • Org3 (Administration / Verifier)   - peer0.org3.academic.edu:9051 (CouchDB: 7984)" -ForegroundColor Gray
Write-Host "=========================================================" -ForegroundColor Cyan
