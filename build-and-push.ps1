#!/usr/bin/env pwsh
Set-Location "C:\Users\ITSAdm\Documents\projects\TohoInfoSpicetify"
Write-Host "Building extension..." -ForegroundColor Green
npx spicetify-creator --no-minify
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Build succeeded!" -ForegroundColor Green
Write-Host "Committing changes..."  -ForegroundColor Green
git add -A
git commit -m "Build updated extension with unminified code"
Write-Host "Pushing to main..." -ForegroundColor Green
git push origin main
Write-Host "Done!" -ForegroundColor Green
