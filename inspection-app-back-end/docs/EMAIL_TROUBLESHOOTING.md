# Имэйл Асуудлыг Шийдвэрлэх Заавар

## Microsoft 365 SMTP Нэвтрэлтийн Асуудал

### Асуудал
```
535 5.7.139 Authentication unsuccessful, user is locked by your organization's security defaults policy.
```

### Шийдлийн Алхмууд

#### 1. SMTP AUTH Статусыг Шалгах (Хийгдсэн ✅)
```powershell
Connect-ExchangeOnline
Get-CASMailbox -Identity "munkhbayar.m@measurement.mn" | Select SmtpClientAuthenticationDisabled
# False байх ёстой (идэвхтэй)
```

#### 2. Байгууллагын Түвшний SMTP AUTH Тохиргоог Шалгах
```powershell
Connect-ExchangeOnline
Get-TransportConfig | Select SmtpClientAuthenticationDisabled
# False байх ёстой (байгууллагын түвшинд идэвхтэй)
```

Хэрэв `True` байвал (идэвхгүй), идэвхжүүлэх:
```powershell
Set-TransportConfig -SmtpClientAuthenticationDisabled $false
```

#### 3. Security Defaults Статусыг Шалгах

**Сонголт А: Azure Portal (Зөвлөмж - Хамгийн Хялбар)**
1. Очих: https://portal.azure.com
2. Админы account-аар нэвтрэх
3. Очих: **Azure Active Directory** → **Properties** → **Manage Security Defaults**
4. "Security defaults" нь **Enabled** эсвэл **Disabled** эсэхийг шалгах

**Сонголт Б: PowerShell (Microsoft Graph Module)**
```powershell
# Microsoft Graph module суулгах (хэрэв суусан байхгүй бол)
Install-Module -Name Microsoft.Graph -Scope CurrentUser -Force

# Microsoft Graph руу холбогдох
Connect-MgGraph -Scopes "Policy.Read.All"

# Security Defaults статусыг шалгах
Get-MgPolicyIdentitySecurityDefaultEnforcementPolicy | Select-Object IsEnabled

# Холболтыг таслах
Disconnect-MgGraph
```

**Сонголт В: PowerShell (AzureAD Module - Хуучин)**
```powershell
# AzureAD module суулгах (хэрэв суусан байхгүй бол)
Install-Module -Name AzureAD -Scope CurrentUser -Force

# Azure AD руу холбогдох
Connect-AzureAD

# Security Defaults шалгах
Get-AzureADPolicy | Where-Object {$_.Type -eq "SecurityDefaults"}
```

#### 4. Өөр Сонголт: Gmail Ашиглах (Хурдан Шийдэл)
Хэрэв Microsoft 365-ийн асуудал үргэлжлэх юм бол Gmail руу шилжих:

1. Gmail account дээр 2-Step Verification идэвхжүүлэх
2. App Password үүсгэх: https://myaccount.google.com/apppasswords
3. `config.env` файлыг шинэчлэх:
```env
NOTIFY_EMAIL_USER=таны_gmail@gmail.com
NOTIFY_EMAIL_PASSWORD=таны_gmail_app_password
NOTIFY_EMAIL_FROM="Inspection App <таны_gmail@gmail.com>"
NOTIFY_EMAIL_HOST=smtp.gmail.com
NOTIFY_EMAIL_PORT=587
NOTIFY_EMAIL_SECURE=false
```

### Одоогийн Статус
- ✅ SMTP AUTH хэрэглэгчийн mailbox-д идэвхтэй
- ✅ SMTP AUTH байгууллагын түвшинд идэвхтэй
- ⚠️ Security Defaults алдаа хэвээр байна
- 🔄 Security Defaults статусыг шалгах шаардлагатай

### Дараагийн Алхмууд
1. Дээрх 3-р алхмын PowerShell командуудыг ажиллуулах
2. Өөрчлөлтүүд тархах хүртэл 15-30 минут хүлээх
3. Имэйл илгээхийг дахин туршиж үзэх
4. Хэрэв асуудал үргэлжлэх юм бол Gmail руу шилжих

### Чухал Тэмдэглэл
- Security Defaults идэвхтэй байвал Basic Authentication-г хориглодог
- App Password ч ажиллахгүй байж болно
- Хэрэв Security Defaults-г унтраах юм бол байгууллагын аюулгүй байдал буурах болно
- Gmail ашиглах нь хамгийн хурдан бөгөөд найдвартай шийдэл байж болно
