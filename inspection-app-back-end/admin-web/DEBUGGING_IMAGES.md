# Зургийн асуудлыг шалгах заавар

## Алдааны мэдээллийг хэрхэн олох

### 1. Browser Console (F12)

**Нээх:**
- Windows/Linux: `F12` эсвэл `Ctrl + Shift + I`
- Mac: `Cmd + Option + I`

**Шалгах зүйлс:**
- Console tab-д дараах тэмдэглэгээг хайж олох:
  - `❌` - Алдааны мэдээлэл
  - `⚠️` - Анхааруулга
  - `✅` - Амжилттай ажилласан
  - `📸` - Зурагтай холбоотой мэдээлэл

**Жишээ:**
```
❌ ========== IMAGE LOADING ERRORS ==========
Section exterior: Failed to fetch
Section indicator: Network error
===========================================
```

### 2. Network Tab

**Нээх:**
1. Browser DevTools (F12) нээх
2. "Network" tab сонгох
3. Хуудасыг дахин ачаалах (Ctrl+R / Cmd+R)

**Шалгах зүйлс:**
- API дуудлагыг хайх: `question-images`
- Status code:
  - `200` - Амжилттай
  - `404` - Олдсонгүй
  - `500` - Server алдаа
  - `403` - Эрх байхгүй

**Response-ийг шалгах:**
1. `question-images` дуудлагыг дарна
2. "Response" tab-ийг шалгана
3. Дараах мэдээллийг баталгаажуулах:
   ```json
   {
     "message": "Question images retrieved successfully",
     "data": {
       "answerId": "437",
       "images": [
         {
           "id": "...",
           "imageData": "iVBORw0KGgo...", // base64 string
           "mimeType": "image/jpeg",
           "section": "exterior"
         }
       ],
       "count": 1
     }
   }
   ```

### 3. Түгээмэл алдаанууд ба шийдэл

#### Алдаа 1: Зураг харагдахгүй байна, гэхдээ API дуудлага амжилттай байна

**Шалтгаан:**
- `imageData` base64 string биш байна
- `imageUrl` үүсээгүй байна
- Base64 string буруу форматтай байна

**Шалгах:**
```javascript
// Console дээр:
console.log('Image data:', response.data.data.images[0]);
console.log('Has imageData:', !!response.data.data.images[0].imageData);
console.log('ImageData type:', typeof response.data.data.images[0].imageData);
console.log('ImageData length:', response.data.data.images[0].imageData?.length);
```

**Шийдэл:**
1. Backend-д `image_data` column-д base64 string хадгалагдаж байгаа эсэхийг шалгах
2. Database-д шууд шалгах:
   ```sql
   SELECT 
     id,
     section,
     LENGTH(image_data) as image_data_length,
     SUBSTRING(image_data, 1, 100) as image_data_preview
   FROM inspection_question_images
   WHERE answer_id = 437;
   ```

#### Алдаа 2: API дуудлага алдаа гаргаж байна (404, 500, 403)

**404 - Олдсонгүй:**
- Answer ID буруу байна
- Route буруу байна
- Шалгах: URL-ийг баталгаажуулах: `/api/inspection-answers/437/question-images`

**500 - Server алдаа:**
- Database холболт алдаатай
- SQL query алдаатай
- Backend console-ийг шалгах (server terminal)

**403 - Эрх байхгүй:**
- User энэ inspection-тэй холбоотой organization-д байхгүй
- Admin эсвэх эсэхийг шалгах

#### Алдаа 3: Зураг ачааллахад алдаа гарч байна (onerror event)

**Шалгах:**
- Console дээр `❌ Image failed to load` мэдээлэл
- Image element-ийн `src` attribute-ийг шалгах
- Data URL формат зөв эсэхийг шалгах: `data:image/jpeg;base64,xxxxx`

**Шийдэл:**
- Base64 string-ийг зөв форматлаж байгаа эсэхийг шалгах
- MIME type зөв эсэхийг шалгах (`image/jpeg`, `image/png`, гэх мэт)

### 4. Backend Console-ийг шалгах

**Шалгах зүйлс:**
- Server terminal дээр дараах мэдээлэл харагдах ёстой:
  ```
  === GET Question Images by Answer ID ===
  Answer ID: 437
  Inspection ID: ...
  Query params - section: exterior
  
  === Query Result ===
  Found 2 image(s) for answer 437
  
  === Formatting Images ===
  [DEBUG] Image 1: Converted Buffer to base64, length: 12345
  ```

**Алдааны мэдээлэл:**
- SQL query алдаа
- Database connection алдаа
- Image data null байна

### 5. Database-ийг шууд шалгах

```sql
-- Бүх зураг олох
SELECT 
  id,
  answer_id,
  section,
  field_id,
  image_order,
  mime_type,
  LENGTH(image_data) as image_size,
  uploaded_at
FROM inspection_question_images
WHERE answer_id = 437
ORDER BY section, field_id, image_order;

-- Тодорхой section-ийн зураг
SELECT 
  id,
  section,
  LENGTH(image_data) as image_size,
  SUBSTRING(image_data, 1, 50) as preview
FROM inspection_question_images
WHERE answer_id = 437 
  AND section = 'exterior';

-- Image data null эсэхийг шалгах
SELECT 
  COUNT(*) as total,
  COUNT(image_data) as with_data,
  COUNT(*) - COUNT(image_data) as null_data
FROM inspection_question_images
WHERE answer_id = 437;
```

### 6. Хуудас дээрх алдааны мэдээлэл

Хэрэв зураг харагдахгүй бол хуудас дээр улаан хайрцаг харагдана:
- "⚠️ Зураг олдсон боловч imageUrl үүсээгүй байна"
- Console-ийг нээх заавар
- Network tab-ийг шалгах заавар

### 7. Quick Debugging Script

Browser Console дээр ажиллуулах:

```javascript
// API дуудлагыг шууд туршиж үзэх
async function debugImages(answerId = 437) {
  try {
    const response = await fetch(`/api/inspection-answers/${answerId}/question-images?section=exterior`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    console.log('API Response:', data);
    console.log('Images count:', data?.data?.images?.length || 0);
    
    if (data?.data?.images?.length > 0) {
      const firstImage = data.data.images[0];
      console.log('First image:', {
        hasImageData: !!firstImage.imageData,
        imageDataLength: firstImage.imageData?.length || 0,
        mimeType: firstImage.mimeType,
        imageDataPreview: firstImage.imageData?.substring(0, 50)
      });
      
      // Зураг үүсгэж үзэх
      if (firstImage.imageData) {
        const img = document.createElement('img');
        img.src = `data:${firstImage.mimeType};base64,${firstImage.imageData}`;
        img.style.width = '200px';
        img.style.border = '2px solid red';
        document.body.appendChild(img);
        console.log('✅ Test image created!');
      }
    }
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Ажиллуулах:
debugImages(437);
```































