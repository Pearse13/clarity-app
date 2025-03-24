# Clarity App - Text Transformer API Update Deployment Script
# This script deploys the updated API endpoint paths to Railway

Write-Host "=================================================="
Write-Host "Clarity App - Deploying API Endpoint Path Updates"
Write-Host "=================================================="
Write-Host ""
Write-Host "This script will deploy the following files:"
Write-Host "- backend/main.py (updated API paths)"
Write-Host "- frontend/project/src/config/api.ts (updated endpoint config)"
Write-Host "- frontend/project/src/pages/TransformPage.tsx (updated API calls)"
Write-Host ""

# Check for Git
if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed or not in your PATH" -ForegroundColor Red
    exit 1
}

# Check if we're in the project root
if (-not (Test-Path "backend/main.py" -PathType Leaf)) {
    Write-Host "Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Git operations
Write-Host "Adding files to git..." -ForegroundColor Cyan
git add backend/main.py
git add frontend/project/src/config/api.ts
git add frontend/project/src/pages/TransformPage.tsx

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m "Update API endpoint paths to be more specific and distinctive"

Write-Host "Pushing changes to Railway deployment branch..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "Deployment initiated!" -ForegroundColor Green
Write-Host "You can monitor the deployment status at https://railway.app/dashboard"
Write-Host ""
Write-Host "After deployment completes:"
Write-Host "1. Test the API connection using the app's 'Test API Connection' button"
Write-Host "2. Try transforming text to ensure the updated endpoints work correctly"
Write-Host "" 