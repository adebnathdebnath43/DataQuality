# Start Backend Server
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location (Join-Path $scriptDir "backend")
Write-Host "Starting Backend Server on port 8003..." -ForegroundColor Green
python -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
