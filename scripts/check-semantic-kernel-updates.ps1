# Check for Semantic Kernel updates that support MaxCompletionTokens

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Checking for SK Updates" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nCurrent version: 1.67.1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Checking for updates..." -ForegroundColor Yellow

# Check outdated packages
cd D:\mimir_experimental\mimir
dotnet list package --outdated

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Update Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To update Semantic Kernel, edit Directory.Packages.props:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  <PackageVersion Include=`"Microsoft.SemanticKernel`" Version=`"1.XX.X`" />"
Write-Host "  <PackageVersion Include=`"Microsoft.SemanticKernel.Abstractions`" Version=`"1.XX.X`" />"
Write-Host ""
Write-Host "Then run:" -ForegroundColor Yellow
Write-Host "  dotnet restore"
Write-Host "  dotnet build"
Write-Host ""
Write-Host "Note: Test thoroughly after upgrading!" -ForegroundColor Red
Write-Host ""

