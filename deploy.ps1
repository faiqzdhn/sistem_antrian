# Deploy Script for Windows PowerShell
# Usage: .\deploy.ps1

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  Sistem Antrian - Deploy Script" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# Check if frontend directory exists
if (-not (Test-Path "frontend")) {
    Write-Host "Error: frontend directory not found!" -ForegroundColor Red
    exit 1
}

# Build frontend
Write-Host "[1/3] Building frontend..." -ForegroundColor Green
Set-Location frontend

try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
} catch {
    Write-Host "Error: Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✓ Build completed successfully`n" -ForegroundColor Green

# Return to root
Set-Location ..

# Deploy to Firebase
Write-Host "[2/3] Deploying to Firebase..." -ForegroundColor Green

try {
    firebase deploy --only hosting
    if ($LASTEXITCODE -ne 0) {
        throw "Deploy failed"
    }
} catch {
    Write-Host "Error: Deploy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Deploy completed successfully`n" -ForegroundColor Green

# Show success message
Write-Host "[3/3] Deployment Complete!" -ForegroundColor Green
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  Deployment successful! 🎉" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# Get hosting URL
Write-Host "Opening Firebase Console..." -ForegroundColor Yellow
firebase open hosting
