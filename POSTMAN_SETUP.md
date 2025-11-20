# Postman Setup - Backend API

## ⚠️ ЧУХАЛ: Backend сервер нь `http://localhost:4555` дээр ажиллаж байна!

**Анхаар:** 
- **Next.js app (admin-web)** нь `http://localhost:3000` дээр ажиллаж байна
- **Backend Express API** нь `http://localhost:4555` дээр ажиллаж байна

Postman-аас Backend API-д хандахдаа **`http://localhost:4555`** ашиглах хэрэгтэй!

## 🔧 Postman тохиргоо

### 1. Login Request

**Method:** `POST`  
**URL:** `http://localhost:4555/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "admin@mmnt.mn",
  "password": "123456789"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Preview API Request

**Method:** `GET`  
**URL:** `http://localhost:4555/api/documents/answers/1/preview`

**Headers:**
```
Authorization: Bearer <тухайн_token>
Content-Type: application/json
```

**Response:**
```json
{
  "data": {
    "inspection": { ... },
    "answer": { ... },
    "d": {
      "images": [
        {
          "id": "1",
          "section": "exterior",
          "fieldId": "sensor_base",
          "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
          "mimeType": "image/jpeg",
          ...
        }
      ]
    }
  }
}
```

## 🐛 Асуудал шийдвэрлэх

### Асуудал: HTML response ирж байна (404)

**Шалтгаан:**
- Буруу порт дээр хандаж байна (`localhost:3000` эсвэл Next.js порт)
- Backend сервер ажиллахгүй байна

**Шийдэл:**

1. **Backend сервер ажиллаж байгаа эсэхийг шалгах:**
   ```bash
   curl http://localhost:4555/health
   ```
   
   Хэрэв ажиллаж байгаа бол:
   ```json
   {
     "status": "OK",
     "timestamp": "2024-01-01T00:00:00.000Z"
   }
   ```

2. **Postman-д зөв URL ашиглах:**
   - ❌ Буруу: `http://localhost:3000/api/auth/login` (Next.js app)
   - ✅ Зөв: `http://localhost:4555/api/auth/login` (Backend API)

3. **Backend сервер эхлүүлэх:**
   ```bash
   cd inspection-app-back-end
   npm start
   # эсвэл
   npm run dev
   ```

### Асуудал: "Connection refused"

**Шалтгаан:**
- Backend сервер ажиллахгүй байна
- Firewall блоклож байна

**Шийдэл:**
1. Backend сервер эхлүүлэх
2. Firewall тохиргоо шалгах
3. Port 4555 нээлттэй эсэхийг шалгах

## 📝 Postman Environment Variable

Postman-д environment variable үүсгэж ашиглах:

1. **Environment үүсгэх:**
   - Name: `Backend API`
   - Variable: `base_url`
   - Value: `http://localhost:4555`

2. **Request-д ашиглах:**
   - URL: `{{base_url}}/api/auth/login`
   - URL: `{{base_url}}/api/documents/answers/1/preview`

3. **Token-ийг environment-д хадгалах:**
   - Tests tab-д:
   ```javascript
   if (pm.response.code === 200) {
       var jsonData = pm.response.json();
       if (jsonData.data && jsonData.data.token) {
           pm.environment.set("auth_token", jsonData.data.token);
       }
   }
   ```

4. **Token ашиглах:**
   - Authorization header-д: `Bearer {{auth_token}}`

## ✅ Шалгах

### 1. Health Check
```
GET http://localhost:4555/health
```

### 2. Login
```
POST http://localhost:4555/api/auth/login
Body: { "email": "...", "password": "..." }
```

### 3. Preview API
```
GET http://localhost:4555/api/documents/answers/1/preview
Headers: Authorization: Bearer <token>
```

Хэрэв бүх request амжилттай бол, Preview API response-д `d.images` массив дахь зургийн `base64` талбарыг шалгах!

