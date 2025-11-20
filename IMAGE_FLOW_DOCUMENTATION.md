# Зураг дамжуулах Flow (FTP Server → Template)

FTP server-ээс template хүртэл зураг дамжих бүх хэсгүүд:

## 1. FTP Server (Storage)
**Байршил:** `C:/ftp_data` (эсвэл `FTP_STORAGE_PATH` environment variable)
- Зурагууд физик файл хэлбэрээр хадгалагдана
- Жишээ: `C:/ftp_data/test/inspection_6_ans_469_field_sensor_base_1763103434538_0.jpg`

**Файл:** `server.js` (line 27-36)
```javascript
const FTP_STORAGE_PATH = process.env.FTP_STORAGE_PATH || path.resolve('C:/ftp_data');
app.use('/uploads', express.static(path.resolve(FTP_STORAGE_PATH)));
```

---

## 2. Database (PostgreSQL)
**Хүснэгт:** `inspection_question_images`
- Зурагны мэдээлэл хадгалагдана:
  - `image_url`: FTP path (жишээ: `ftp://192.168.0.6/test/inspection_6_ans_469_field_sensor_base_1763103434538_0.jpg`)
  - `section`: Хэсэг (жишээ: `exterior`, `indicator`, `jbox`)
  - `field_id`: Талбарын ID (жишээ: `sensor_base`, `led_display`)
  - `image_order`: Зургийн дараалал
  - `answer_id`: Хариултын ID

---

## 3. loadImagePayload (FTP → Base64)
**Файл:** `utils/imageStorage.js` (line 119-174)
**Функц:** `loadImagePayload(relativePath)`

**Ажиллагаа:**
1. FTP path-ийг local path руу хөрвүүлэх (`resolveLocalPath`)
2. Файлыг унших (`fs.readFile`)
3. Base64 руу хөрвүүлэх (`fileBuffer.toString('base64')`)

**Гаралт:**
```javascript
{
  base64: string,  // Base64 string
  size: number,    // Файлын хэмжээ (bytes)
  localPath: string // Local файлын зам
}
```

**Жишээ:**
```javascript
const payload = await loadImagePayload('test/inspection_6_ans_469_field_sensor_base_1763103434538_0.jpg');
// Result: { base64: 'iVBORw0KGgo...', size: 12345, localPath: 'C:/ftp_data/test/...' }
```

---

## 4. loadImagesForAnswer (Database → Image Objects)
**Файл:** `services/report-service.js` (line 33-112)
**Функц:** `loadImagesForAnswer(prisma, answerId)`

**Ажиллагаа:**
1. Database-аас зурагны мэдээлэл авах (`prisma.$queryRaw`)
2. `loadImagePayload` дуудах (base64 авах)
3. MIME type тодорхойлох (`inferMimeType`)
4. Image object үүсгэх

**Гаралт:**
```javascript
[
  {
    id: string,
    section: string,        // 'exterior', 'indicator', etc.
    fieldId: string,        // 'sensor_base', 'led_display', etc.
    order: number,
    imageUrl: string,
    storagePath: string,
    base64: string,         // Base64 string
    mimeType: string,       // 'image/jpeg', 'image/png', etc.
    uploadedAt: Date
  },
  ...
]
```

---

## 5. buildInspectionReportData (Report Data бэлтгэх)
**Файл:** `services/report-service.js`
**Функц:** `buildInspectionReportData(prisma, answerId)`

**Ажиллагаа:**
1. `loadImagesForAnswer` дуудах (зурагууд авах)
2. Report data бэлтгэх (inspection, contractor, metadata, etc.)
3. Зурагуудыг `d.images` array-д нэмэх

**Гаралт:**
```javascript
{
  d: {
    images: [
      { section: 'exterior', fieldId: 'sensor_base', base64: '...', mimeType: 'image/jpeg', ... },
      ...
    ],
    // ... бусад report data
  }
}
```

---

## 6. groupImagesBySectionAndField (Бүлэглэх)
**Файл:** `routes/documents.js` (line 222-271)
**Функц:** `groupImagesBySectionAndField(images)`

**Ажиллагаа:**
1. Зурагуудыг `section.fieldId`-аар бүлэглэх
2. `createImageContent` дуудах (image object үүсгэх)

**Гаралт:**
```javascript
{
  'exterior.sensor_base': [
    { _type: 'image', source: Buffer, format: MimeType.Jpeg, width: 300, height: 200 },
    ...
  ],
  'indicator.led_display': [...],
  ...
}
```

---

## 7. createImageContent (Image Object үүсгэх)
**Файл:** `routes/documents.js` (line 40-184)
**Функц:** `createImageContent(imageData)`

**Ажиллагаа:**
1. Base64-ийг Buffer руу хөрвүүлэх (`Buffer.from(base64, 'base64')`)
2. MIME type-ийг MimeType enum руу хөрвүүлэх (`MIME_TYPE_MAP`)
3. Image object үүсгэх (easy-template-x-д зориулсан)

**Гаралт:**
```javascript
{
  _type: 'image',
  source: Buffer,           // Buffer object
  format: MimeType.Jpeg,    // MimeType enum (string)
  width: 300,
  height: 200
}
```

**MIME Type Mapping:**
```javascript
const MIME_TYPE_MAP = {
  'image/png': MimeType.Png,
  'image/jpeg': MimeType.Jpeg,
  'image/jpg': MimeType.Jpeg,
  'image/gif': MimeType.Gif,
  'image/bmp': MimeType.Bmp,
  'image/svg+xml': MimeType.Svg,
};
```

---

## 8. Template Data (Template-д нэмэх)
**Файл:** `routes/documents.js` (line 393-606)
**Хэсэг:** DOCX generation route (`/api/documents/answers/:answerId/docx`)

**Ажиллагаа:**
1. `groupImagesBySectionAndField` дуудах
2. Template data-д нэмэх:
   - **Flattened key:** `templateData['d.images.exterior.sensor_base'] = [image1, image2, ...]`
   - **Nested structure:** `templateData.d.images.exterior.sensor_base = [image1, image2, ...]`
3. `hasImages` утга нэмэх:
   - `templateData['d.hasImages.exterior.sensor_base'] = true`
   - `templateData.d.hasImages.exterior.sensor_base = true`

**Template Data Structure:**
```javascript
{
  // Flattened keys
  'd.images.exterior.sensor_base': [
    { _type: 'image', source: Buffer, format: MimeType.Jpeg, width: 300, height: 200 },
    ...
  ],
  'd.hasImages.exterior.sensor_base': true,
  
  // Nested structure
  d: {
    images: {
      exterior: {
        sensor_base: [
          { _type: 'image', source: Buffer, format: MimeType.Jpeg, width: 300, height: 200 },
          ...
        ]
      }
    },
    hasImages: {
      exterior: {
        sensor_base: true
      }
    }
  }
}
```

---

## 9. easy-template-x (Template-д орлуулах)
**Файл:** `routes/documents.js` (line 698-701)
**Library:** `easy-template-x`

**Ажиллагаа:**
1. Template файлыг унших (`template.docx`)
2. Template data-тай хослуулах (`templateHandler.process`)
3. Loop placeholder-ийг боловсруулах:
   - `{{#d.images.exterior.sensor_base}}` → Loop эхлэх
   - `{{/d.images.exterior.sensor_base}}` → Loop дуусах
   - Loop-ийн дотор зураг placeholder (Alt Text="image") олох
   - Зураг placeholder-ийг template data-аас зурагаар орлуулах
4. DOCX файл үүсгэх

**Template Placeholder:**
```docx
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
{{#d.images.exterior.sensor_base}}
[Image with Alt Text="image"]
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

---

## Дүгнэлт

**Нийт 9 хэсэг:**

1. ✅ **FTP Server** - Зураг хадгалагдаж байгаа газар
2. ✅ **Database** - Зурагны мэдээлэл хадгалагдаж байгаа
3. ✅ **loadImagePayload** - FTP → Base64
4. ✅ **loadImagesForAnswer** - Database → Image Objects
5. ✅ **buildInspectionReportData** - Report Data бэлтгэх
6. ✅ **groupImagesBySectionAndField** - Бүлэглэх
7. ✅ **createImageContent** - Image Object үүсгэх
8. ✅ **Template Data** - Template-д нэмэх
9. ✅ **easy-template-x** - Template-д орлуулах

**Алдаа гарч болох хэсгүүд:**
- ❌ FTP storage path буруу байвал → `loadImagePayload` алдаа гарна
- ❌ Base64 хөрвүүлэлт буруу байвал → `createImageContent` алдаа гарна
- ❌ MIME type mapping буруу байвал → `format` undefined байна
- ❌ Template data structure буруу байвал → `easy-template-x` зураг олохгүй
- ❌ Template placeholder буруу байвал → `easy-template-x` зураг орлуулахгүй

