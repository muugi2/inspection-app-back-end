# Өөр WiFi дээр байгаа device-ээс хандах заавар

## ⚠️ Асуудал:

**192.168.0.6** нь **local network IP** байдаг тул:
- Зөвхөн ижил WiFi network дээрх device-үүд хандах боломжтой
- Өөр WiFi network дээрх device-үүд хандах **боломжгүй**

## ✅ Шийдэл: Ngrok ашиглах

Ngrok нь таны local server-ийг public internet дээр ашиглах боломжтой болгоно.

## 📋 Алхмууд:

### Алхам 1: Ngrok URL олох

**Сонголт A: Web Interface (Хамгийн амар)**

1. Browser дээр нээх: **http://localhost:4040**
2. **Forwarding** хэсэгт URL харагдана:
   - Жишээ: `https://digestible-betsey-aberrantly.ngrok-free.dev`

**Сонголт B: Logs-оос**

```powershell
docker-compose logs ngrok | Select-String "started tunnel"
```

### Алхам 2: Admin Web URL-ийг өөрчлөх

Ngrok нь backend-ийг public болгож байна. Одоо admin-web-ийг ngrok URL-аар хандах хэрэгтэй.

**Admin Web URL:**
```
https://your-ngrok-url.ngrok-free.dev
```

**Гэхдээ** admin-web нь одоо backend URL ашиглаж байна. Би admin-web-ийг ngrok URL ашиглах болгож өгөх хэрэгтэй.

### Алхам 3: Admin Web-ийг ngrok URL ашиглах болгох

**Хэрэв admin-web нь backend-тай ижил ngrok URL ашиглах бол:**
- Ngrok нь backend руу forward хийж байна
- Admin web нь backend URL-ийг ngrok URL болгож ашиглах хэрэгтэй

## 🔧 Тохиргоо:

### Сонголт 1: Admin Web-ийг ngrok URL ашиглах болгох

`docker-compose.yml` файлд admin-web environment variable засах:

```yaml
admin-web:
  environment:
    - NEXT_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.dev
```

### Сонголт 2: Admin Web-ийг тусдаа ngrok tunnel ашиглах

Admin web-д тусдаа ngrok tunnel үүсгэх хэрэгтэй.

## 🎯 Одоогийн байдал:

- **Backend**: Ngrok URL-аар хандаж болно
- **Admin Web**: Local network дээрх device-үүд хандаж болно
- **Admin Web**: Өөр WiFi дээрх device-үүд хандах боломжгүй

## ✅ Хамгийн амар шийдэл:

### Сонголт A: Ижил WiFi network ашиглах

1. Өөр laptop-ийг ижил WiFi network дээр холбох
2. 192.168.0.6:3002 руу хандах

### Сонголт B: Ngrok URL ашиглах

1. Ngrok URL олох (http://localhost:4040)
2. Admin web-ийг ngrok URL ашиглах болгох
3. Эсвэл admin web-д тусдаа ngrok tunnel үүсгэх

## 📝 Дэлгэрэнгүй:

Ngrok-ийн талаар: **NGROK_SETUP.md**
Docker ngrok setup: **DOCKER_NGROK_SETUP.md**

