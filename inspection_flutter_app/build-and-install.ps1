# PowerShell script to build and install Flutter app

param(
    [string]$DeviceIp = "",
    [switch]$UseWifi = $false,
    [switch]$BuildOnly = $false
)

Write-Host "=== Flutter App Build & Install ===" -ForegroundColor Green
Write-Host ""

# Change to Flutter app directory
$flutterAppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $flutterAppDir

Write-Host "📱 Building APK..." -ForegroundColor Cyan
flutter build apk --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ APK build successful!" -ForegroundColor Green
Write-Host ""

$apkPath = "build/app/outputs/flutter-apk/app-release.apk"

if ($BuildOnly) {
    Write-Host "📦 APK location: $apkPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To install manually:" -ForegroundColor Cyan
    Write-Host "  adb install $apkPath" -ForegroundColor White
    exit 0
}

# Check for connected devices
Write-Host "🔍 Checking for connected devices..." -ForegroundColor Cyan
flutter devices

if ($UseWifi -and $DeviceIp) {
    Write-Host ""
    Write-Host "📡 Connecting via WiFi to $DeviceIp:5555..." -ForegroundColor Cyan
    adb connect "$DeviceIp:5555"
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "📲 Installing APK..." -ForegroundColor Cyan
flutter install --release

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Installation successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now disconnect USB if using WiFi ADB." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Installation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual installation:" -ForegroundColor Yellow
    Write-Host "  adb install $apkPath" -ForegroundColor White
}

