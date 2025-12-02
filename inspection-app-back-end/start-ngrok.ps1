# PowerShell script to start Ngrok in Docker

Write-Host "=== Starting Ngrok in Docker ===" -ForegroundColor Green
Write-Host ""

# Check if NGROK_AUTHTOKEN is set
$env:NGROK_AUTHTOKEN = (Get-Content config.env | Select-String "NGROK_AUTHTOKEN" | ForEach-Object { $_ -replace "NGROK_AUTHTOKEN=", "" }).Trim()

if ([string]::IsNullOrWhiteSpace($env:NGROK_AUTHTOKEN)) {
    Write-Host "⚠️  NGROK_AUTHTOKEN is not set in config.env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please add your Ngrok auth token to config.env:" -ForegroundColor Cyan
    Write-Host "  NGROK_AUTHTOKEN=your_token_here" -ForegroundColor White
    Write-Host ""
Write-Host "Or set it as environment variable:" -ForegroundColor Cyan
Write-Host '  $env:NGROK_AUTHTOKEN="your_token_here"' -ForegroundColor White
    Write-Host ""
    
    # Ask user to input token
    $token = Read-Host "Enter your Ngrok auth token (or press Enter to skip)"
    if (![string]::IsNullOrWhiteSpace($token)) {
        $env:NGROK_AUTHTOKEN = $token
        Write-Host "✅ Token set for this session" -ForegroundColor Green
    } else {
        Write-Host "❌ Cannot start Ngrok without auth token" -ForegroundColor Red
        exit 1
    }
}

Write-Host "📦 Pulling Ngrok Docker image..." -ForegroundColor Cyan
docker pull ngrok/ngrok:latest

Write-Host ""
Write-Host "🚀 Starting Ngrok service..." -ForegroundColor Cyan
docker-compose up -d ngrok

Write-Host ""
Write-Host "⏳ Waiting for Ngrok to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "📊 Checking Ngrok status..." -ForegroundColor Cyan
docker-compose ps ngrok

Write-Host ""
Write-Host "📝 Ngrok logs (last 20 lines):" -ForegroundColor Cyan
docker-compose logs --tail 20 ngrok

Write-Host ""
Write-Host "=== Ngrok Started ===" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Web Interface: http://localhost:4040" -ForegroundColor Yellow
Write-Host ""
Write-Host "To view logs in real-time:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f ngrok" -ForegroundColor White
Write-Host ""
Write-Host "To stop Ngrok:" -ForegroundColor Cyan
Write-Host "  docker-compose stop ngrok" -ForegroundColor White

