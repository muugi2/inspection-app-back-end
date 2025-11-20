# Test all required ports for Inspection App
# Run this script AFTER applying firewall rules

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Inspection App Портууд Шалгах" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$serverIP = "192.198.0.6"
$ports = @{
    "2121" = "FTP Control Port"
    "21000" = "FTP Passive (Start)"
    "21010" = "FTP Passive (End)"
    "4555" = "Backend API"
    "3306" = "MySQL Database"
    "3001" = "Carbone Service"
}

Write-Host "Сервер: $serverIP" -ForegroundColor Yellow
Write-Host ""

$allPassed = $true

foreach ($port in $ports.Keys | Sort-Object) {
    $description = $ports[$port]
    Write-Host "Шалгаж байна: $description (Port $port)..." -NoNewline
    
    try {
        $result = Test-NetConnection -ComputerName $serverIP -Port $port -WarningAction SilentlyContinue -ErrorAction Stop
        
        if ($result.TcpTestSucceeded) {
            Write-Host " ✅ АМЖИЛТТАЙ" -ForegroundColor Green
        } else {
            Write-Host " ❌ АМЖИЛТГҮЙ" -ForegroundColor Red
            $allPassed = $false
        }
    } catch {
        Write-Host " ❌ АЛДАА: $_" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "✅ БҮХ ПОРТУУД АЖИЛЛАЖ БАЙНА!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Одоо та Flutter app-аас зураг авч үзэж болно." -ForegroundColor White
} else {
    Write-Host "❌ ЗАРИМ ПОРТУУД АЖИЛЛАХГҮЙ БАЙНА" -ForegroundColor Red
    Write-Host ""
    Write-Host "Шийдэл:" -ForegroundColor Yellow
    Write-Host "1. firewall-quick-fix.bat файлыг Administrator эрхээр ажиллуулна уу" -ForegroundColor White
    Write-Host "2. Docker containers дахин эхлүүлнэ үү:" -ForegroundColor White
    Write-Host "   docker-compose down && docker-compose up -d" -ForegroundColor Gray
    Write-Host "3. Windows Firewall асаалттай эсэхийг шалгана уу" -ForegroundColor White
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Additional diagnostics
Write-Host "Нэмэлт мэдээлэл:" -ForegroundColor Cyan
Write-Host ""

# Check Docker status
Write-Host "Docker Containers:" -ForegroundColor Yellow
try {
    $dockerPS = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
    if ($dockerPS) {
        Write-Host $dockerPS -ForegroundColor White
    } else {
        Write-Host "⚠️ Docker ажиллахгүй байна эсвэл container байхгүй" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Docker олдсонгүй. Docker Desktop суулгасан эсэхийг шалгана уу." -ForegroundColor Yellow
}

Write-Host ""

# Check firewall rules
Write-Host "Firewall Дүрмүүд:" -ForegroundColor Yellow
try {
    $rules = Get-NetFirewallRule -DisplayName "*Docker*","*Backend*","*MySQL*","*Carbone*" -ErrorAction SilentlyContinue
    if ($rules) {
        $rules | Select-Object DisplayName, Enabled | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor White
    } else {
        Write-Host "⚠️ Firewall дүрэм олдсонгүй! setup-firewall.ps1 ажиллуулна уу." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Firewall дүрмүүдийг шалгах боломжгүй" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Дуусгавар" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan




