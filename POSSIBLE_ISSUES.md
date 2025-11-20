# Template дээр боломжит алдаанууд

## ✅ Олдсон асуудлууд:

### 1. Template дээр loop placeholder дутуу (28 дутуу)
- **Одоогоор:** 4 loop placeholder байна
- **Шаардлагатай:** 32 loop placeholder
- **Дутуу:** 28 loop placeholder
- **Үр дагавар:** 28 field-ийн зураг харагдахгүй байна

### 2. Placeholder зурагууд loop-ийн гадна байна (28 зураг)
- **Одоогоор:** 28 placeholder зураг loop-ийн гадна байна
- **Шаардлагатай:** Бүх placeholder зураг loop-ийн дотор байх ёстой
- **Үр дагавар:** Эдгээр зурагууд ажиллахгүй байна (loop placeholder байхгүй тул)

### 3. Одоогийн 4 loop-д 2 зураг байна
- **Одоогоор:** Loop бүрт 2 placeholder зураг байна
- **Шаардлагатай:** Loop бүрт зөвхөн 1 placeholder зураг байх ёстой
- **Үр дагавар:** Loop зөвхөн эхний зурагийг ашиглана, 2-р зураг ашиглагдахгүй
- **Тайлбар:** Энэ нь том асуудал биш, гэхдээ template-ийг цэвэрлэх шаардлагатай

---

## ✅ Шалгасан, зөв байгаа зүйлс:

### 1. Image data structure
- ✅ `_type: 'image'` - зөв
- ✅ `source: Buffer` - зөв
- ✅ `format: MimeType.Jpeg` (string enum) - зөв
- ✅ `width: 300, height: 200` - зөв

### 2. Template data structure
- ✅ `d.images.exterior.sensor_base: [image1, image2, ...]` - зөв
- ✅ `d.hasImages.exterior.sensor_base: true/false` - зөв

### 3. Image placeholder Alt Text
- ✅ Alt Text = "image" (placeholder биш) - зөв
- ✅ 64 placeholder зураг байна (Alt Text="image")

### 4. Format type
- ✅ `MimeType` нь string enum байна (зөв)
- ✅ Log-оос харахад format зөв байна

---

## ❓ Шалгах шаардлагатай зүйлс:

### 1. easy-template-x зурагийг хэрхэн орлуулж байгаа?
- Log-оос харахад template processing амжилттай байна (200 OK)
- Гэхдээ зураг харагдахгүй байна
- Магадгүй easy-template-x зураг placeholder-ийг олохгүй байж магадгүй?

**Шалгах арга:**
```bash
# Template дээр зураг placeholder-ийн XML бүтцийг шалгах
node scripts/check-template-image-placeholders.js
```

### 2. Loop placeholder-ууд paragraph дээр байгаа эсэх?
- easy-template-x loop placeholder-ууд paragraph дээр байх шаардлагатай
- Template дээр paragraph зөв байгаа эсэхийг шалгах хэрэгтэй

### 3. Image placeholder loop-ийн дотор байгаа эсэх?
- Одоогийн 4 loop-д зураг placeholder байгаа (✅ зөв)
- Гэхдээ 28 зураг loop-ийн гадна байна (❌ буруу)

### 4. easy-template-x зурагийг хэрхэн хайж байгаа?
- easy-template-x зурагийг Alt Text="image" ашиглан хайж байгаа эсэх?
- Магадгүй бусад шалгалт хийх шаардлагатай байж магадгүй?

---

## 🔧 Шийдэл:

### Шаардлагатай алхамууд:

1. **Template дээр бүх 32 loop placeholder-ыг нэмэх**
   - `TEMPLATE_LOOPS_TO_ADD.md` файлыг ашиглах

2. **Loop-ийн гаднах placeholder зурагуудыг устгах эсвэл loop-ийн дотор байрлуулах**
   - Одоогийн 28 placeholder зураг loop-ийн гадна байна
   - Эдгээрийг зөв loop-ийн дотор байрлуулах хэрэгтэй

3. **Одоогийн 4 loop-д зөвхөн 1 placeholder зураг үлдээх**
   - Одоо loop бүрт 2 зураг байна
   - Эхний зураг үлдээж, 2-р зурагийг устгах

---

## 📊 Одоогийн template-ийн төлөв:

```
✅ 4 loop placeholder байна:
   - indicator.led_display (2 зураг дотор)
   - jbox.box_integrity (2 зураг дотор)
   - cleanliness.top_platform (2 зураг дотор)
   - cleanliness.gap_platform_ramp (2 зураг дотор)

❌ 28 loop placeholder дутуу:
   - exterior (6 дутуу)
   - indicator (5 дутуу)
   - jbox (4 дутуу)
   - sensor (5 дутуу)
   - foundation (6 дутуу)
   - cleanliness (2 дутуу)

❌ 28 placeholder зураг loop-ийн гадна байна
   - Эдгээр зурагууд ажиллахгүй байна
```

---

## 🎯 Дараагийн алхам:

1. Template дээр бүх 32 loop placeholder-ыг нэмэх
2. Loop-ийн гаднах placeholder зурагуудыг устгах
3. Одоогийн 4 loop-д зөвхөн 1 placeholder зураг үлдээх
4. Template-ийг дахин шалгах:
   ```bash
   node scripts/analyze-all-loops-complete.js
   node scripts/check-image-in-loop.js
   ```
5. DOCX үүсгэж, зураг харагдаж байгаа эсэхийг шалгах

