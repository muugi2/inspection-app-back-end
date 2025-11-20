# Windows Firewall дүрэм нэмэх script (FTP портууд)
# Энэ script-г Administrator эрхээр ажиллуулах шаардлагатай

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "FTP Server Firewall Тохиргоо" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Одоо байгаа дүрмүүдийг устгах (хэрэв байвал)
Write-Host "1. Хуучин дүрмүүдийг шалгаж байна..." -ForegroundColor Yellow

$existingRules = @(
    "FTP Server Control",
    "FTP Server Passive Mode",
    "Docker FTP Control",
    "Docker FTP Passive",
    "Backend API Server",
    "MySQL Database",
    "Carbone Service",
    "Docker Desktop Backend"
)

foreach ($ruleName in $existingRules) {
    $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($rule) {
        Write-Host "   - Устгаж байна: $ruleName" -ForegroundColor Gray
        Remove-NetFirewallRule -DisplayName $ruleName
    }
}

Write-Host ""
Write-Host "2. Шинэ firewall дүрмүүд үүсгэж байна..." -ForegroundColor Yellow

# FTP Control Port (2121 - Docker mapped port)
try {
    New-NetFirewallRule `
        -DisplayName "Docker FTP Control" `
        -Description "Allow FTP control connection on port 2121" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 2121 `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ FTP Control Port 2121 нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Алдаа: $_" -ForegroundColor Red
}

# FTP Passive Mode Ports (21000-21010)
try {
    New-NetFirewallRule `
        -DisplayName "Docker FTP Passive" `
        -Description "Allow FTP passive mode connections on ports 21000-21010" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 21000-21010 `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ FTP Passive Ports 21000-21010 нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Алдаа: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Нэмэлт портууд нээж байна..." -ForegroundColor Yellow

# API Server Port (4555)
try {
    New-NetFirewallRule `
        -DisplayName "Backend API Server" `
        -Description "Allow API server on port 4555" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 4555 `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ API Port 4555 нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Алдаа: $_" -ForegroundColor Red
}

# MySQL Port (3306)
try {
    New-NetFirewallRule `
        -DisplayName "MySQL Database" `
        -Description "Allow MySQL database on port 3306" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3306 `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ MySQL Port 3306 нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Алдаа: $_" -ForegroundColor Red
}

# Carbone Port (3001)
try {
    New-NetFirewallRule `
        -DisplayName "Carbone Service" `
        -Description "Allow Carbone service on port 3001" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 3001 `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ Carbone Port 3001 нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Алдаа: $_" -ForegroundColor Red
}

# Docker Desktop (for Windows)
try {
    New-NetFirewallRule `
        -DisplayName "Docker Desktop Backend" `
        -Description "Allow Docker Desktop backend communication" `
        -Direction Inbound `
        -Program "C:\Program Files\Docker\Docker\resources\com.docker.backend.exe" `
        -Action Allow `
        -Profile Any `
        -Enabled True
    Write-Host "   ✅ Docker Desktop нээгдлээ" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Docker Desktop rule: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "4. Firewall дүрмүүдийг шалгаж байна..." -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan

# Үүссэн дүрмүүдийг харуулах
Get-NetFirewallRule -DisplayName "Docker FTP*","Backend API*","MySQL*","Carbone*","Docker Desktop*" | 
    Select-Object DisplayName, Enabled, Direction, Action | 
    Format-Table -AutoSize

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ Firewall тохиргоо амжилттай!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Дараагийн алхмууд:" -ForegroundColor Cyan
Write-Host "1. Docker container-уудыг дахин эхлүүлэх:" -ForegroundColor White
Write-Host "   cd inspection-app-back-end" -ForegroundColor Gray
Write-Host "   docker-compose down" -ForegroundColor Gray
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Tablet-аас дахин шалгах:" -ForegroundColor White
Write-Host "   nmap -Pn -p 2121,21000-21010,4555 192.168.1.10" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Портууд ажиллаж байгаа эсэхийг шалгах:" -ForegroundColor White
Write-Host "   .\test-firewall-ports.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Flutter app-г дахин build хийх:" -ForegroundColor White
Write-Host "   cd inspection_flutter_app" -ForegroundColor Gray
Write-Host "   flutter run" -ForegroundColor Gray
Write-Host ""





