# FTP Холболт Шалгах Диагностик Script
# Энэ script нь Administrator эрх шаардахгүй

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FTP Холболт Диагностик" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. IP Configuration шалгах
Write-Host "[1] IP Хаяг Шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.0.*" }
if ($adapters) {
    foreach ($adapter in $adapters) {
        Write-Host "   ✓ Олдсон: $($adapter.IPAddress)" -ForegroundColor Green
        $interface = Get-NetIPInterface -InterfaceIndex $adapter.InterfaceIndex
        Write-Host "     Interface: $($interface.InterfaceAlias)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ 192.168.0.x сүлжээнд IP хаяг олдсонгүй!" -ForegroundColor Red
    Write-Host "   → USB tethering идэвхтэй эсэхийг шалгана уу" -ForegroundColor Yellow
}
Write-Host ""

# 2. Docker Container шалгах
Write-Host "[2] Docker Container Шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
try {
    $ftpContainer = docker ps --filter "name=ftp_server" --format "{{.Names}} | {{.Status}}"
    if ($ftpContainer) {
        Write-Host "   ✓ FTP Server: $ftpContainer" -ForegroundColor Green
    } else {
        Write-Host "   ✗ FTP Server ажиллахгүй байна!" -ForegroundColor Red
        Write-Host "   → docker-compose up -d ажиллуулна уу" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Docker ажиллахгүй байна эсвэл суулгаагүй" -ForegroundColor Red
}
Write-Host ""

# 3. Local Port байгаа эсэхийг шалгах
Write-Host "[3] FTP Port (21) нээлттэй эсэхийг шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
$port21 = Get-NetTCPConnection -LocalPort 21 -State Listen -ErrorAction SilentlyContinue
if ($port21) {
    Write-Host "   ✓ Port 21 LISTEN горимд байна" -ForegroundColor Green
} else {
    Write-Host "   ✗ Port 21 сонсохгүй байна!" -ForegroundColor Red
    Write-Host "   → FTP server ажиллахгүй байна" -ForegroundColor Yellow
}
Write-Host ""

# 4. Firewall дүрмүүд шалгах
Write-Host "[4] Firewall Дүрмүүд шалгаж байна..." -ForegroundColor Yellow
Write-Host ""

$ftpRules = Get-NetFirewallRule -DisplayName "*FTP*","*Docker FTP*" -ErrorAction SilentlyContinue | 
    Where-Object {$_.Enabled -eq $true -and $_.Direction -eq "Inbound"}

if ($ftpRules) {
    Write-Host "   Идэвхтэй дүрмүүд:" -ForegroundColor Green
    foreach ($rule in $ftpRules) {
        Write-Host "   ✓ $($rule.DisplayName)" -ForegroundColor Green
        
        # Port мэдээлэл харуулах
        $portFilters = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule
        if ($portFilters.LocalPort) {
            Write-Host "     Портууд: $($portFilters.LocalPort)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "   ✗ FTP firewall дүрэм байхгүй!" -ForegroundColor Red
    Write-Host "   → firewall-quick-fix.bat ажиллуулна уу (Administrator эрх шаардлагатай)" -ForegroundColor Yellow
}
Write-Host ""

# 5. Firewall Profile шалгах
Write-Host "[5] Firewall Profile шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
$profiles = Get-NetFirewallProfile | Select-Object Name, Enabled
foreach ($profile in $profiles) {
    $status = if ($profile.Enabled) { "Идэвхтэй" } else { "Идэвхгүй" }
    $color = if ($profile.Enabled) { "Yellow" } else { "Green" }
    Write-Host "   $($profile.Name): $status" -ForegroundColor $color
}
Write-Host ""

# 6. Test Connection
Write-Host "[6] Орон нутгаас Port 21 шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
$testLocal = Test-NetConnection -ComputerName "127.0.0.1" -Port 21 -WarningAction SilentlyContinue
if ($testLocal.TcpTestSucceeded) {
    Write-Host "   ✓ Localhost (127.0.0.1:21) холболт амжилттай" -ForegroundColor Green
} else {
    Write-Host "   ✗ Localhost холболт амжилтгүй" -ForegroundColor Red
    Write-Host "   → FTP server зөв ажиллахгүй байна" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[7] 192.168.0.6:21 шалгаж байна..." -ForegroundColor Yellow
Write-Host ""
$test192 = Test-NetConnection -ComputerName "192.168.0.6" -Port 21 -WarningAction SilentlyContinue
if ($test192.TcpTestSucceeded) {
    Write-Host "   ✓ 192.168.0.6:21 холболт амжилттай!" -ForegroundColor Green
    Write-Host "   → Tablet-аас холбогдох боломжтой байх ёстой" -ForegroundColor Green
} else {
    Write-Host "   ✗ 192.168.0.6:21 холболт амжилтгүй" -ForegroundColor Red
    Write-Host "   → IP хаяг буруу эсвэл firewall блоклож байна" -ForegroundColor Yellow
}
Write-Host ""

# Дүгнэлт
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ДҮГНЭЛТ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($test192.TcpTestSucceeded -and $port21) {
    Write-Host "✓ Бүх зүйл зөв байна! Tablet-аас холбогдох боломжтой." -ForegroundColor Green
} else {
    Write-Host "✗ Асуудал илэрлээ. Дараах алхмуудыг хийнэ үү:" -ForegroundColor Red
    Write-Host ""
    
    if (-not $port21) {
        Write-Host "1. Docker container-ыг эхлүүлнэ:" -ForegroundColor Yellow
        Write-Host "   cd inspection-app-back-end" -ForegroundColor Gray
        Write-Host "   docker-compose up -d" -ForegroundColor Gray
        Write-Host ""
    }
    
    if (-not $ftpRules) {
        Write-Host "2. Firewall дүрэм нэмнэ (Administrator эрх шаардлагатай):" -ForegroundColor Yellow
        Write-Host "   .\firewall-quick-fix.bat" -ForegroundColor Gray
        Write-Host "   (Файлыг баруун товшоод 'Run as administrator' сонгоно)" -ForegroundColor Gray
        Write-Host ""
    }
    
    if (-not $adapters) {
        Write-Host "3. USB tethering идэвхжүүлнэ:" -ForegroundColor Yellow
        Write-Host "   Tablet: Settings > Network > USB tethering ON" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host ""
Write-Host "Шинжилгээ дууслаа. Tablet-аас дахин оролдоно уу:" -ForegroundColor Cyan
Write-Host "  ftp 192.168.0.6" -ForegroundColor White
Write-Host ""








