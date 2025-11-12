# 🔥 Firewall Асуудал - Хурдан Шийдэл

## ⚡ Хурдан Засвар (2 минут)

### Алхам 1: Firewall Дүрэм Нэмэх

**Аргын хоёр сонголт:**

#### **А) Batch файл (Хамгийн хялбар)**
1. `firewall-quick-fix.bat` дээр хулганы **баруун товч** дарна
2. **"Run as administrator"** сонгоно
3. Enter дарж баталгаажуулна

#### **Б) PowerShell (Санлагдах)**
1. Administrator эрхээр PowerShell нээнэ
2. Дараах командыг ажиллуулна:
```powershell
cd C:\Users\munhb\inspection_app\inspection-app-back-end
.\setup-firewall.ps1
```

### Алхам 2: Docker Дахин Эхлүүлэх

```bash
cd C:\Users\munhb\inspection_app\inspection-app-back-end
docker-compose down
docker-compose up -d
```

### Алхам 3: Шалгах

```powershell
.\test-firewall-ports.ps1
```

Хэрэв **БҮХ ПОРТУУД ✅** харагдвал - **АМЖИЛТТАЙ!** 🎉

---

## 📋 Нээгдсэн портууд

| Порт | Хэрэглээ |
|------|----------|
| 2121 | FTP холболт |
| 21000-21010 | FTP өгөгдөл |
| 4555 | Backend API |
| 3306 | MySQL |
| 3001 | Carbone |

---

## ❌ Асуудал үргэлжлбэл

### 1️⃣ Дүрмүүд үүсээгүй эсэх

```powershell
# Шалгах
Get-NetFirewallRule -DisplayName "*Docker*","*Backend*","*MySQL*"

# Хэрэв хоосон бол дахин оролдох
.\setup-firewall.ps1
```

### 2️⃣ Docker ажиллахгүй байна

```bash
# Docker статус шалгах
docker ps

# Хэрэв алдаа гарвал Docker Desktop дахин эхлүүлэх
```

### 3️⃣ Портууд хаалттай байна

```powershell
# Портууд хаагдсан эсэхийг шалгах
Test-NetConnection -ComputerName 192.168.0.7 -Port 2121
Test-NetConnection -ComputerName 192.168.0.7 -Port 4555
```

Хэрэв **TcpTestSucceeded : False** гарвал:
- Firewall асаалттай эсэхийг шалгах
- Дүрмүүдийг дахин нэмэх
- Антивирус программ блоклож байгаа эсэхийг шалгах

### 4️⃣ Flutter app холбогдохгүй байна

`lib/config/app_config.dart` файлыг шалгаарай:

```dart
static const String ftpHost = '192.168.0.7';
static const int ftpPort = 2121;  // ☑️ Энэ 2121 байх ёстой!
```

---

## 🔧 Туслах командууд

### Firewall бүхэлдээ шалгах
```powershell
netsh advfirewall show allprofiles
```

### Firewall түр унтраах (Тест хийх үед)
```powershell
# АНХААРУУЛГА: Аюулгүй бус!
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False

# Дахин асаах
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

### Docker логууд үзэх
```bash
docker logs ftp_server
docker logs inspection_mysql
docker logs inspection_carbone_1
```

### Tablet-аас шалгах (Termux)
```bash
# FTP шалгах
ftp 192.168.0.7 2121
# user: test
# pass: T3st!234

# Портууд скан хийх
nmap -Pn -p 2121,21000-21010,4555 192.168.0.7
```

---

## ✅ Амжилттай ажилласан эсэхийг яаж мэдэх вэ?

1. ✅ `test-firewall-ports.ps1` бүх портууд ногоон
2. ✅ `docker ps` бүх container "Up" төлөвт байна
3. ✅ Flutter app зураг татаж авч болж байна
4. ✅ Firewall асаалттай үед ч ажиллаж байна

---

## 📞 Тусламж хэрэгтэй бол

Дараах файлуудыг уншиж үзээрэй:
- `FIREWALL_FIX_GUIDE.md` - Дэлгэрэнгүй зааварчилгаа
- `ADD_FIREWALL_RULES.txt` - Хуучин заавар
- `NETWORK_ISSUE_SOLUTION.md` - Сүлжээний асуудал

---

**Онцлох:** Firewall-ийн гол алдаа нь FTP порт **21** биш **2121** байсан!

