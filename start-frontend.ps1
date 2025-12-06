# Start Frontend Server
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
Write-Host "Starting Frontend Server on port 5173..." -ForegroundColor Green
node node_modules/vite/bin/vite.js
