# Ngrok Docker дээр ажиллуулах заавар

## ✅ Бэлтгэлтэй зүйлс:

1. ✅ Ngrok Docker image татагдсан
2. ✅ Docker Compose дээр ngrok service нэмэгдсэн
3. ✅ Container эхэлж байна

## ⚠️ Одоо хийх зүйл: Auth Token оруулах

Ngrok ажиллахын тулд auth token шаардлагатай.

### Алхам 1: Auth Token авах

1. https://dashboard.ngrok.com/ руу нэвтрэх
2. **Your Authtoken** хэсгээс token-ийг хуулж авах
   - Эсвэл: https://dashboard.ngrok.com/get-started/your-authtoken

### Алхам 2: Token оруулах

**Сонголт A: config.env файлд нэмэх**

`config.env` файлд нэмэх:

```env
NGROK_AUTHTOKEN=your_token_here
```

**Сонголт B: Environment variable (зөвхөн энэ session-д)**

PowerShell дээр:

```powershell
$env:NGROK_AUTHTOKEN="your_token_here"
```

### Алхам 3: Ngrok service restart хийх

```powershell
docker-compose restart ngrok
```

Эсвэл:

```powershell
docker-compose down
docker-compose up -d
```

### Алхам 4: Шалгах

**Logs шалгах:**
```powershell
docker-compose logs ngrok
```

**Web Interface:**
- http://localhost:4040

**Container status:**
```powershell
docker-compose ps ngrok
```

## 🎯 Ашигтай командууд:

```powershell
# Ngrok service эхлүүлэх
docker-compose up -d ngrok

# Ngrok service зогсоох
docker-compose stop ngrok

# Ngrok logs харах
docker-compose logs -f ngrok

# Ngrok URL авах (web interface-ээс)
Start-Process http://localhost:4040
```

## 📝 Flutter app дээр ашиглах:

Ngrok URL-ийг Flutter app дээр backend URL болгон ашиглах:

```dart
// Example:
final baseUrl = 'https://your-ngrok-url.ngrok-free.dev';
```

## ❌ Алдаа гарвал:

**"authentication failed"** гэсэн алдаа гарвал:
- Auth token зөв оруулсан эсэхийг шалгах
- Token-ийг дахин хуулж авах
- Container-ийг restart хийх

## ✅ Амжилттай болвол:

Ngrok web interface дээр (http://localhost:4040):
- **Forwarding** хэсэгт URL харагдана
- Энэ URL-ийг Flutter app дээр ашиглах

