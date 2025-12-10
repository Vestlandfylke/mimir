# Force restart Teams desktop app to clear cache

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting Teams Desktop App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Closing all Teams processes..." -ForegroundColor Yellow
Get-Process -Name "*teams*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Closing: $($_.ProcessName)" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Waiting for processes to close..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Starting Teams..." -ForegroundColor Yellow
$teamsPath = "C:\Users\$env:USERNAME\AppData\Local\Microsoft\Teams\current\Teams.exe"

if (Test-Path $teamsPath) {
    Start-Process $teamsPath
    Write-Host "✅ Teams started" -ForegroundColor Green
} else {
    Write-Host "⚠️  Teams not found at: $teamsPath" -ForegroundColor Yellow
    Write-Host "Please start Teams manually from Start Menu" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Teams Restarted!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Wait for Teams to fully load (~30 seconds)" -ForegroundColor White
Write-Host "  2. Open Mimir app" -ForegroundColor White
Write-Host "  3. Should auto-login now!" -ForegroundColor White
Write-Host ""
Write-Host "If still not working:" -ForegroundColor Yellow
Write-Host "  - Open DevTools: Ctrl+Shift+I in Mimir tab" -ForegroundColor Gray
Write-Host "  - Check Console for errors" -ForegroundColor Gray
Write-Host "  - Look for Teams SDK initialization messages" -ForegroundColor Gray
Write-Host ""

