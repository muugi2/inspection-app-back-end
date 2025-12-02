# Docker дээр Ngrok ажиллуулах заавар

## Төлөвлөлт:

Ngrok-ийг Docker Compose дотор service болгон нэмсэн. Одоо cmd дээр ngrok ажиллуулах шаардлагагүй.

## Алхам 1: Ngrok Auth Token авах

1. https://dashboard.ngrok.com/ руу нэвтрэх
2. **Your Authtoken** хэсгээс token-ийг хуулж авах

## Алхам 2: Environment Variable тохируулах

`config.env` файлд (эсвэл `.env` файлд) ngrok auth token нэмэх:

```env
NGROK_AUTHTOKEN=your_ngrok_authtoken_here
```

Эсвэл Docker Compose-д шууд:

```bash
export NGROK_AUTHTOKEN="your_ngrok_authtoken_here"
```

## Алхам 3: Ngrok service эхлүүлэх

```powershell
cd inspection-app-back-end
docker-compose up -d ngrok
```

Эсвэл бүх services-ийг дахин эхлүүлэх:

```powershell
docker-compose down
docker-compose up -d
```

## Алхам 4: Ngrok URL авах

Ngrok web interface-ийг нээх:
- http://localhost:4040

Эсвэл logs-оос URL-ийг харах:

```powershell
docker-compose logs ngrok
```

## Алхам 5: Flutter app дээр URL солих

Flutter app дээр ngrok URL-ийг backend URL болгон ашиглах:

```dart
// Old:
final baseUrl = 'http://192.168.0.6:4555';

// New (ngrok URL):
final baseUrl = 'https://your-ngrok-url.ngrok-free.dev';
```

## Шалгах:

1. **Ngrok status**: http://localhost:4040
2. **Backend health**: `https://your-ngrok-url.ngrok-free.dev/health`
3. **Logs**: `docker-compose logs -f ngrok`

## Асуудал гарвал:

### Ngrok container эхлэхгүй байвал:

```powershell
# Logs шалгах
docker-compose logs ngrok

# Container status шалгах
docker-compose ps ngrok
```

### Auth token буруу байвал:

1. https://dashboard.ngrok.com/get-started/your-authtoken руу очих
2. Token-ийг дахин хуулж авах
3. `config.env` файлд дахин оруулах
4. Container restart хийх: `docker-compose restart ngrok`

## Ашигтай командууд:

```powershell
# Ngrok service эхлүүлэх
docker-compose up -d ngrok

# Ngrok service зогсоох
docker-compose stop ngrok

# Ngrok logs харах
docker-compose logs -f ngrok

# Бүх services restart хийх
docker-compose restart
```

