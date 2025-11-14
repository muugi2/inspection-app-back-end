# Firewall Асуудал Шийдэх Зааварчилгаа

## 🔍 Асуудлын шинжилгээ

Firewall унтарсан үед бүх зүйл ажиллаж байсан боловч асаахад ажиллахгүй болсон. Үүний шалтгаан нь **firewall тохиргоо дутуу байсан**.

### Олдсон асуудлууд:

1. ❌ **FTP порт буруу байсан**: Script-д порт 21 нээсэн байсан, харин Docker нь 2121 порт ашигладаг
2. ❌ **MySQL порт (3306) нээгдээгүй байсан**
3. ❌ **Carbone порт (3001) нээгдээгүй байсан**
4. ❌ **Docker Desktop-ийн firewall дүрэм байхгүй**

## ✅ Шийдэл

### Хувилбар 1: PowerShell Script (Санлагдах)

1. **Administrator эрхээр PowerShell нээнэ үү**:
   - Windows товч дээр хулганы баруун товчоор дарна
   - "Windows PowerShell (Admin)" эсвэл "Terminal (Admin)" сонгоно

2. **Inspection-app-back-end фолдер руу очино**:
   ```powershell
   cd C:\Users\munhb\inspection_app\inspection-app-back-end
   ```

3. **Script ажиллуулна**:
   ```powershell
   .\setup-firewall.ps1
   ```

### Хувилбар 2: Batch File (Хялбар)

1. **`firewall-quick-fix.bat`** файл дээр хулганы баруун товчоор дарна
2. **"Run as administrator"** сонгоно
3. Заавар дагана

## 📋 Нээгдэх портууд

| Порт      | Үйлчилгээ           | Тайлбар                          |
|-----------|---------------------|----------------------------------|
| 2121      | FTP Control         | FTP холболт (Docker mapped)      |
| 21000-21010| FTP Passive Mode   | FTP өгөгдөл дамжуулалт          |
| 4555      | Backend API         | Node.js Express сервер           |
| 3306      | MySQL Database      | Өгөгдлийн сан                    |
| 3001      | Carbone Service     | Документ үүсгэх үйлчилгээ        |

## 🔧 Засварлалтын дараах алхмууд

### 1. Docker container-уудыг дахин эхлүүлэх

```bash
cd inspection-app-back-end
docker-compose down
docker-compose up -d
```

### 2. Firewall дүрмүүдийг шалгах

**PowerShell-ээр:**
```powershell
Get-NetFirewallRule -DisplayName "Docker*","Backend*","MySQL*","Carbone*" | 
    Select-Object DisplayName, Enabled, Direction, Action | 
    Format-Table -AutoSize
```

**Command Prompt-оор:**
```cmd
netsh advfirewall firewall show rule name=all | findstr "Docker FTP Backend MySQL Carbone"
```

### 3. Холболт шалгах

**Tablet эсвэл өөр төхөөрөмжөөс:**

```bash
# FTP холболт шалгах
ftp 192.168.0.6 2121

# API холболт шалгах
curl http://192.168.0.6:4555/health

# Портууд нээлттэй эсэхийг шалгах (Termux дээр)
nmap -Pn -p 2121,21000-21010,4555,3306,3001 192.168.0.6
```

**Windows компьютер дээрээс:**

```powershell
# Портууд нээлттэй эсэхийг шалгах
Test-NetConnection -ComputerName 192.168.0.6 -Port 2121
Test-NetConnection -ComputerName 192.168.0.6 -Port 4555
Test-NetConnection -ComputerName 192.168.0.6 -Port 3306
```

## 🐛 Асуудал үргэлжилбэл

### Дүрэм 1: Firewall дүрмүүдийг гараар устгаад дахин үүсгэх

**PowerShell (Administrator):**
```powershell
# Устгах
Remove-NetFirewallRule -DisplayName "Docker FTP Control"
Remove-NetFirewallRule -DisplayName "Docker FTP Passive"
Remove-NetFirewallRule -DisplayName "Backend API Server"
Remove-NetFirewallRule -DisplayName "MySQL Database"
Remove-NetFirewallRule -DisplayName "Carbone Service"

# Дахин script ажиллуулах
.\setup-firewall.ps1
```

### Дүрэм 2: Firewall-ийг түр унтраах (Тест хийх зорилгоор)

**АНХААРУУЛГА: Энэ нь аюулгүй бус!**

```powershell
# Унтраах (Administrator)
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Тест хийсний дараа дахин асаах
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Дүрэм 3: Docker Desktop-ийг дахин эхлүүлэх

1. Docker Desktop-г хаах
2. Administrator эрхээр дахин нээх
3. Docker Daemon дахин эхлэхийг хүлээх
4. Containers-уудыг дахин ажиллуулах

### Дүрэм 4: Windows Defender Firewall-ийг GUI-аар тохируулах

1. **Windows Defender Firewall with Advanced Security** нээх
2. **Inbound Rules** сонгох
3. **New Rule...** дарах
4. **Port** сонгоод **Next**
5. **TCP** сонгоод портууд оруулах: `2121, 21000-21010, 4555, 3306, 3001`
6. **Allow the connection** сонгох
7. **Domain, Private, Public** бүгдийг чагтлах
8. Нэр өгөх: "Inspection App All Ports"
9. **Finish**

## 📱 Flutter App тохиргоо шалгах

Flutter app-н тохиргоо файлыг шалгаарай:

```dart
// lib/config/app_config.dart
class AppConfig {
  static const String baseUrl = 'http://192.168.0.6:4555/api';
  static const String ftpHost = '192.168.0.6';
  static const int ftpPort = 2121;  // Энэ 2121 байх ёстой!
  static const String ftpUser = 'test';
  static const String ftpPassword = 'T3st!234';
}
```

## 🔍 Логууд шалгах

### Docker логууд:

```bash
# FTP сервер лог
docker logs ftp_server

# Backend лог (хэрэв Docker-т ажиллаж байвал)
docker logs inspection_app

# Бүх контейнерийн статус
docker ps -a
```

### Backend лог (Local):

```bash
cd inspection-app-back-end
npm run dev
```

## ✅ Амжилттай холбогдсон эсэхийг шалгах

1. ✅ Firewall дүрмүүд үүссэн
2. ✅ Docker containers ажиллаж байна
3. ✅ `Test-NetConnection` амжилттай
4. ✅ Flutter app зураг татаж болж байна
5. ✅ FTP холболт амжилттай

## 📞 Тусламж

Хэрэв асуудал үргэлжилвэл дараах мэдээллийг цуглуулаад илгээнэ үү:

```powershell
# 1. Firewall дүрмүүд
Get-NetFirewallRule -DisplayName "*Docker*","*Backend*","*MySQL*","*Carbone*" | 
    Select-Object DisplayName, Enabled, Direction, Action, LocalPort | 
    Format-List | Out-File firewall-rules.txt

# 2. Docker статус
docker ps -a > docker-status.txt

# 3. Порт холболт тест
Test-NetConnection -ComputerName 192.168.0.6 -Port 2121 > port-test.txt
Test-NetConnection -ComputerName 192.168.0.6 -Port 4555 >> port-test.txt
Test-NetConnection -ComputerName 192.168.0.6 -Port 3306 >> port-test.txt

# 4. Docker логууд
docker logs ftp_server > ftp-logs.txt 2>&1
```

---

**Засварласан он сар:** 2024-11-12  
**Хувилбар:** 2.0  
**Статус:** ✅ Тестлэгдсэн




