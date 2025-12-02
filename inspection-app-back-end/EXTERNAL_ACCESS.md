# Өөр WiFi дээр байгаа Device-ээс хандах заавар

## ⚠️ Асуудал:

**192.168.0.6:3002** нь зөвхөн **ижил WiFi network** дээрх device-үүд хандах боломжтой.

Өөр WiFi network дээрх laptop-оос хандах боломжгүй.

## ✅ Шийдэл: Ngrok ашиглах

Ngrok нь таны local server-ийг public internet дээр ашиглах боломжтой болгоно.

## 🎯 Ngrok URLs:

### Backend API:
- Ngrok URL: `https://digestible-betsey-aberrantly.ngrok-free.dev`
- Local: `http://192.168.0.6:4555`

### Admin Web:
- Ngrok URL: (ngrok-admin-web service эхлээд URL олох хэрэгтэй)
- Local: `http://192.168.0.6:3002`

## 📋 Хандах арга замууд:

### Сонголт 1: Ижил WiFi Network (Хамгийн амар)

1. Өөр laptop-ийг **measurement Engineers** WiFi дээр холбох
2. Browser дээр: `http://192.168.0.6:3002`

### Сонголт 2: Ngrok URL ашиглах (Өөр WiFi дээрх device-үүд)

1. Ngrok Admin Web URL олох:
   ```powershell
   docker-compose logs ngrok-admin-web | Select-String "started tunnel"
   ```
   Эсвэл web interface: **http://localhost:4041**

2. Browser дээр ngrok URL ашиглах:
   ```
   https://your-ngrok-admin-web-url.ngrok-free.dev
   ```

## 🔧 Ngrok URLs олох:

### Backend Ngrok:
```powershell
# Web Interface
http://localhost:4040

# Эсвэл logs
docker-compose logs ngrok | Select-String "started tunnel"
```

### Admin Web Ngrok:
```powershell
# Web Interface
http://localhost:4041

# Эсвэл logs
docker-compose logs ngrok-admin-web | Select-String "started tunnel"
```

## 📝 Жишээ:

### Backend:
- Local: `http://192.168.0.6:4555`
- Ngrok: `https://digestible-betsey-aberrantly.ngrok-free.dev`

### Admin Web:
- Local: `http://192.168.0.6:3002`
- Ngrok: `https://your-ngrok-admin-web-url.ngrok-free.dev` (service эхэлсний дараа URL олох)

## ⚠️ Анхаарах зүйлс:

1. **Ngrok Free plan** дээр URL солигдож болно (server restart хийвэл)
2. **Ngrok Free plan** дээр connection limits байна
3. **Production** дээр paid ngrok plan эсвэл өөр solution ашиглах нь дээр

## ✅ Одоо хийх зүйл:

1. Ngrok Admin Web URL-ийг олох
2. Өөр laptop-оос ngrok URL ашиглах
3. Эсвэл ижил WiFi network дээр холбох

