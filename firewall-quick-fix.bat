@echo off
echo ====================================
echo FTP Firewall Quick Fix
echo ====================================
echo.
echo ВАЖНО: Энэ файлыг "Run as administrator" хийж ажиллуулна уу!
echo.
pause

echo Хуучин дүрмүүдийг устгаж байна...
netsh advfirewall firewall delete rule name="Docker FTP Control" >nul 2>&1
netsh advfirewall firewall delete rule name="Docker FTP Passive" >nul 2>&1
netsh advfirewall firewall delete rule name="Backend API Server" >nul 2>&1
netsh advfirewall firewall delete rule name="MySQL Database" >nul 2>&1
netsh advfirewall firewall delete rule name="Carbone Service" >nul 2>&1
netsh advfirewall firewall delete rule name="Docker Desktop Backend" >nul 2>&1

echo.
echo Шинэ дүрмүүд үүсгэж байна...
echo.

echo [1/6] FTP Control Port 2121...
netsh advfirewall firewall add rule name="Docker FTP Control" dir=in action=allow protocol=TCP localport=2121 enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ✗ АЛДАА: Administrator эрхгүй байна?
)

echo [2/6] FTP Passive Ports 21000-21010...
netsh advfirewall firewall add rule name="Docker FTP Passive" dir=in action=allow protocol=TCP localport=21000-21010 enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ✗ АЛДАА: Administrator эрхгүй байна?
)

echo [3/6] Backend API Port 4555...
netsh advfirewall firewall add rule name="Backend API Server" dir=in action=allow protocol=TCP localport=4555 enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ✗ АЛДАА: Administrator эрхгүй байна?
)

echo [4/6] MySQL Port 3306...
netsh advfirewall firewall add rule name="MySQL Database" dir=in action=allow protocol=TCP localport=3306 enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ✗ АЛДАА: Administrator эрхгүй байна?
)

echo [5/6] Carbone Port 3001...
netsh advfirewall firewall add rule name="Carbone Service" dir=in action=allow protocol=TCP localport=3001 enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ✗ АЛДАА: Administrator эрхгүй байна?
)

echo [6/6] Docker Desktop...
netsh advfirewall firewall add rule name="Docker Desktop Backend" dir=in action=allow program="C:\Program Files\Docker\Docker\resources\com.docker.backend.exe" enable=yes profile=any
if %errorlevel% equ 0 (
    echo    ✓ Амжилттай
) else (
    echo    ⚠ Docker Desktop rule (optional)
)

echo.
echo ====================================
echo Шалгаж байна...
echo ====================================
netsh advfirewall firewall show rule name="Docker FTP Control"
netsh advfirewall firewall show rule name="Docker FTP Passive"

echo.
echo ====================================
echo Дууссан! Дараагийн алхмууд:
echo   1. docker-compose restart
echo   2. Tablet-аас дахин шалгах:
echo      ftp 192.168.1.10 2121
echo ====================================
pause





