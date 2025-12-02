# Admin Web Production Build Guide

## 🎯 Бэлтгэлтэй зүйлс:

1. ✅ Dockerfile үүсгэсэн
2. ✅ Next.js config standalone mode идэвхжсэн
3. ✅ Docker Compose дээр admin-web service нэмэгдсэн
4. ✅ Environment variables тохируулсан

## 📦 Production Build хийх:

### Алхам 1: Build хийх

```powershell
cd inspection-app-back-end/admin-web
npm run build
```

### Алхам 2: Docker Image Build хийх

```powershell
cd inspection-app-back-end
docker-compose build admin-web
```

### Алхам 3: Admin Web Service эхлүүлэх

```powershell
docker-compose up -d admin-web
```

### Алхам 4: Бүх services-ийг эхлүүлэх

```powershell
docker-compose up -d
```

## 🌐 Хандах:

- **Admin Web**: http://192.168.0.6:3002 (эсвэл SERVER_IP:ADMIN_WEB_PORT)
- **Backend API**: http://192.168.0.6:4555
- **Ngrok Web Interface**: http://localhost:4040

## ⚙️ Environment Variables:

### config.env файлд нэмэх (optional):

```env
ADMIN_WEB_PORT=3002
SERVER_IP=192.168.0.6
BACKEND_PORT=4555
```

### Admin Web container дотор:

- `NEXT_PUBLIC_API_URL`: Backend API URL (автоматаар тохируулагдана)

## 🔧 Тохиргоо:

### Port өөрчлөх:

`docker-compose.yml` файлд:

```yaml
ports:
  - '3002:3001'  # host:container
```

Эсвэл environment variable:

```env
ADMIN_WEB_PORT=3002
```

### Backend URL өөрчлөх:

`docker-compose.yml` файлд:

```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://your-backend-url:port
```

## 🐛 Troubleshooting:

### Build алдаа гарвал:

```powershell
# Logs шалгах
docker-compose logs admin-web

# Container status
docker-compose ps admin-web

# Container дотор шалгах
docker exec -it inspection_admin_web sh
```

### Port эзлэгдсэн байвал:

```powershell
# Port ашиглаж байгаа process-ийг олох
netstat -ano | Select-String ":3002"

# Process зогсоох
Stop-Process -Id <PID> -Force
```

### Static files харагдахгүй байвал:

```powershell
# Container дотор file-ууд байгаа эсэхийг шалгах
docker exec inspection_admin_web ls -la /app/.next/static
```

## ✅ Шалгах:

1. **Browser дээр нээх**: http://192.168.0.6:3002
2. **Login page харагдах ёстой**
3. **Backend API холбогдох ёстой**

## 📝 Шинэчлэлт:

1. Admin web code өөрчлөх
2. Build дахин хийх: `docker-compose build admin-web`
3. Restart хийх: `docker-compose restart admin-web`

## 🚀 Production Tips:

1. **Environment variables**: `.env` файлыг ашиглах
2. **SSL/HTTPS**: Reverse proxy (nginx) ашиглах
3. **Logging**: Container logs-ийг monitor хийх
4. **Backup**: Regular backup хийх

