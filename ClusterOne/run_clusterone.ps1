# ClusterOne Platform Quick Launch Script (Windows / Linux PowerShell)
# Launches the FastAPI Core Cluster Engine and Vite Production Control Plane

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       ClusterOne - DIU CSE GPU Cluster Control Platform" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Anchor Master: 10.20.0.10 | Compute Subnet: 10.20.0.0/24" -ForegroundColor Gray
Write-Host ""

$BackendDir = Join-Path $PSScriptRoot "backend"
$FrontendDir = Join-Path $PSScriptRoot "frontend"

# 1. Check Python virtual environment
$PythonExe = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "[1/3] Verifying Backend environment..." -ForegroundColor Yellow
& $PythonExe -c "import fastapi, uvicorn, sqlalchemy; print('  Backend dependencies verified.')"

# 2. Check Frontend build
Write-Host "[2/3] Verifying Frontend production bundle..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $FrontendDir "dist\index.html"))) {
    Write-Host "  Building frontend with Vite..." -ForegroundColor Gray
    Push-Location $FrontendDir
    npm run build
    Pop-Location
} else {
    Write-Host "  Production bundle present in frontend/dist." -ForegroundColor Gray
}

# 3. Instructions for running
Write-Host ""
Write-Host "[3/3] Ready to Launch!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the FastAPI Backend Engine:" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  .\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "To seed authentic DIU CSE 12-week pilot nodes & workloads:" -ForegroundColor White
Write-Host "  .\.venv\Scripts\python scripts\seed_pilot_cluster.py" -ForegroundColor Gray
Write-Host ""
Write-Host "To start the Frontend Control Portal:" -ForegroundColor White
Write-Host "  cd frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Access ClusterOne portal at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

