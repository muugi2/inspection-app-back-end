# Word Template дээр Loop Placeholder-уудыг зөв оруулах заавар

## ⚠️ Чухал: Word дээр placeholder-уудыг зөв оруулах арга

Word template дээр condition болон loop placeholder-уудыг оруулахдаа дараах алхмуудыг дагана уу:

## 📝 Алхам алхмаар заавар

### 1. Condition эхлэх placeholder оруулах

```
{{#d.hasImages.exterior.sensor_base}}
```

**Оруулах арга:**
1. Word-д хүснэгтийн доор **шинэ paragraph** үүсгэх (Enter дарах)
2. Энэ paragraph дээр шууд бичих: `{{#d.hasImages.exterior.sensor_base}}`
3. **Чухал:** Placeholder-ийг бүхэлд нь нэг paragraph дээр бичих
4. Placeholder-ийг **копилох/хуулах** хэрэггүй - шууд бичих

### 2. Field гарчиг оруулах

```
Мэдрэгчийн суурь:
```

**Оруулах арга:**
1. Condition placeholder-ийн доор **шинэ paragraph** үүсгэх
2. Энэ paragraph дээр бичих: `Мэдрэгчийн суурь:`

### 3. Loop эхлэх placeholder оруулах

```
{{#d.images.exterior.sensor_base}}
```

**Оруулах арга:**
1. Field гарчигийн доор **шинэ paragraph** үүсгэх
2. Энэ paragraph дээр шууд бичих: `{{#d.images.exterior.sensor_base}}`
3. **Чухал:** Placeholder-ийг бүхэлд нь нэг paragraph дээр бичих

### 4. Placeholder зураг оруулах

**Оруулах арга:**
1. Loop placeholder-ийн доор **Insert → Pictures → This Device** (эсвэл ямар ч placeholder зураг)
2. Зургийг сонгох
3. Зургийг **right-click** → **Format Picture** (эсвэл **Picture Format** tab)
4. **Alt Text** → **Description** дээр оруулах: `image`
5. **Чухал:** Зөвхөн `image` гэж бичих (placeholder биш!)

### 5. Loop дуусгах placeholder оруулах

```
{{/d.images.exterior.sensor_base}}
```

**Оруулах арга:**
1. Placeholder зурагийн доор **шинэ paragraph** үүсгэх
2. Энэ paragraph дээр шууд бичих: `{{/d.images.exterior.sensor_base}}`

### 6. Condition дуусгах placeholder оруулах

```
{{/d.hasImages.exterior.sensor_base}}
```

**Оруулах арга:**
1. Loop дуусгах placeholder-ийн доор **шинэ paragraph** үүсгэх
2. Энэ paragraph дээр шууд бичих: `{{/d.hasImages.exterior.sensor_base}}`

## ✅ Бүтэн жишээ

Word template дээр дараах байдлаар харагдах ёстой:

```
[Paragraph 1]
{{#d.hasImages.exterior.sensor_base}}

[Paragraph 2]
Мэдрэгчийн суурь:

[Paragraph 3]
{{#d.images.exterior.sensor_base}}

[Paragraph 4 - Placeholder зураг]
[Зураг - Alt Text: image]

[Paragraph 5]
{{/d.images.exterior.sensor_base}}

[Paragraph 6]
{{/d.hasImages.exterior.sensor_base}}
```

## ⚠️ Алдаа гаргахгүй байх

### ❌ Буруу арга:
- Placeholder-уудыг копилох/хуулах
- Placeholder-уудыг хэд хэдэн paragraph-д хуваах
- Placeholder-уудыг text box эсвэл table cell дотор оруулах (зарим тохиолдолд)
- Placeholder-уудыг Word-ийн Field код хэлбэрээр оруулах

### ✅ Зөв арга:
- Placeholder-уудыг шууд paragraph дээр бичих
- Placeholder-уудыг бүхэлд нь нэг paragraph дээр бичих
- Placeholder-уудыг ямар ч форматгүй (plain text) хэлбэрээр бичих

## 🔍 Шалгах арга

Template файлыг хадгалсны дараа дараах скрипт ажиллуулж шалгана уу:

```bash
cd inspection-app-back-end
node scripts/check-template-sensor-base.js
```

Энэ нь template файлд placeholder-ууд зөв оруулагдсан эсэхийг шалгана.

## 📌 Тайлбар

- **Condition placeholder** (`{{#d.hasImages...}}`) нь зураг байвал энэ хэсгийг харуулна
- **Loop placeholder** (`{{#d.images...}}`) нь зураг бүрийн хувьд placeholder зурагийг давтана
- **Placeholder зураг** (Alt Text = `image`) нь loop-ийн дотор байрлана
- **Closing placeholder** (`{{/d.images...}}` болон `{{/d.hasImages...}}`) нь loop болон condition-ийг дуусгана

## 🎯 Дүгнэлт

Word template дээр placeholder-уудыг оруулахдаа:
1. **Шууд paragraph дээр бичих** - ямар ч тусгай командууд шаардлагагүй
2. **Plain text хэлбэрээр бичих** - форматгүй
3. **Бүхэлд нь нэг paragraph дээр бичих** - хуваахгүй
4. **Placeholder зурагийн Alt Text = `image`** - placeholder биш!









