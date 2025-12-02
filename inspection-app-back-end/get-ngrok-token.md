# Ngrok Auth Token олох заавар

## 🔑 Auth Token олох:

### Арга 1: Dashboard дээр

1. **Browser дээр нээх:**
   - https://dashboard.ngrok.com/get-started/your-authtoken
   - Эсвэл: https://dashboard.ngrok.com/api-keys

2. **Token хуулж авах:**
   - Dashboard дээр "Your Authtoken" хэсэгт token харагдана
   - "Copy" товч дарж хуулна

### Арга 2: Ngrok config file дээр

Хэрэв та өмнө ngrok ашиглаж байсан бол:

**Windows:**
```
C:\Users\YourUsername\AppData\Local\ngrok\ngrok.yml
```

**Linux/Mac:**
```
~/.ngrok2/ngrok.yml
```

Файл дотор `authtoken: ...` гэсэн мөр олох.

### Арга 3: Ngrok command-оос

Хэрэв ngrok аль хэдийн тохируулагдсан бол:

```bash
ngrok config check
```

## 📝 Token оруулах:

### config.env файлд нэмэх:

```env
NGROK_AUTHTOKEN=2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

**Жишээ:**
```env
# Ngrok Configuration
NGROK_AUTHTOKEN=2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### Эсвэл Environment Variable:

PowerShell:
```powershell
$env:NGROK_AUTHTOKEN="2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
```

## ✅ Дараа нь:

```powershell
docker-compose restart ngrok
```

## 🔗 Холбоос:

- Dashboard: https://dashboard.ngrok.com/
- Auth Token: https://dashboard.ngrok.com/get-started/your-authtoken
- API Keys: https://dashboard.ngrok.com/api-keys

