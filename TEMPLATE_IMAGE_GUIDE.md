# Template дээр зураг оруулах заавар

## 🎯 Хоёр арга байна: Loop (динамик) vs Index (тогтмол)

### ✅ Арга 1: Loop бүтэц (Динамик тооны зураг) - **ЗӨВЛӨМЖЛӨХ**

Энэ арга нь зураг тоо тогтмол биш үед ашиглах ёстой. Backend кодод `d.images.exterior.sensor_base` гэсэн массив бэлтгэж байгаа тул энэ аргыг ашиглах хэрэгтэй.

**Дэлгэрэнгүй заавар:** [TEMPLATE_LOOP_PLACEHOLDERS_GUIDE.md](./TEMPLATE_LOOP_PLACEHOLDERS_GUIDE.md)

#### Template бүтэц:

```
[Paragraph 1]
{{#d.hasImages.exterior.sensor_base}}

[Paragraph 2]
Тавцангийн лист:

[Paragraph 3]
{{#d.images.exterior.sensor_base}}

[Paragraph 4 - Placeholder зураг]
[Зураг - Alt Text Description: image]

[Paragraph 5]
{{/d.images.exterior.sensor_base}}

[Paragraph 6]
{{/d.hasImages.exterior.sensor_base}}
```

**Чухал:**
- Loop placeholder (`{{#d.images.exterior.sensor_base}}`) нь **paragraph дээр** байрлана
- Placeholder зурагийн **Alt Text Description = `image`** (placeholder биш!)
- Loop нь зураг бүрийн хувьд placeholder зурагийг давтана

### ⚠️ Арга 2: Index placeholder (Тогтмол тооны зураг)

Энэ арга нь зураг тоо тогтмол үед ашиглана (жишээ: үргэлж 3 зураг байна).

#### 1. Section-ийн эхлэлд condition текст оруулах:

"Автожингийн тавцан" section-ийн хүснэгтийн өмнө paragraph дээр:

```
{{#d.hasImages.exterior}}
```

#### 2. Section-ийн доор placeholder зураг оруулах:

1. Insert → Pictures → Placeholder зураг оруулах
2. Зургийг сонгох
3. Alt Text → Description дээр оруулах:
   ```
   {{d.images.exterior.0}}
   ```

#### 3. Хэрэв олон зураг байх бол:

Placeholder зураг 2: Alt Text = `{{d.images.exterior.1}}`  
Placeholder зураг 3: Alt Text = `{{d.images.exterior.2}}`  
... гэх мэт

#### 4. Section-ийн төгсгөлд condition дуусгах:

Зурагуудын доор paragraph дээр:
```
{{/d.hasImages.exterior}}
```

**Алдаа:** Backend кодод зураг байхгүй үед placeholder зураг харагдана.

## ✅ Санал: Loop бүтэц ашиглах (Арга 1) - Динамик тооны зураг

### Loop бүтэц - Field бүрийн жишээ:

#### Exterior section - sensor_base field:

```
{{#d.hasImages.exterior.sensor_base}}
Тавцангийн лист:
{{#d.images.exterior.sensor_base}}
[Placeholder зураг - Alt Text: image]
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

#### Бусад field-үүд:

**Exterior:**
- `{{#d.hasImages.exterior.beam}}` ... `{{/d.hasImages.exterior.beam}}` (Alt Text: `image`)
- `{{#d.hasImages.exterior.platform_plate}}` ... `{{/d.hasImages.exterior.platform_plate}}` (Alt Text: `image`)
- `{{#d.hasImages.exterior.beam_joint_plate}}` ... `{{/d.hasImages.exterior.beam_joint_plate}}` (Alt Text: `image`)
- `{{#d.hasImages.exterior.stop_bolt}}` ... `{{/d.hasImages.exterior.stop_bolt}}` (Alt Text: `image`)
- `{{#d.hasImages.exterior.interplatform_bolts}}` ... `{{/d.hasImages.exterior.interplatform_bolts}}` (Alt Text: `image`)

**Indicator:**
- `{{#d.hasImages.indicator.led_display}}` ... `{{/d.hasImages.indicator.led_display}}` (Alt Text: `image`)
- `{{#d.hasImages.indicator.power_plug}}` ... `{{/d.hasImages.indicator.power_plug}}` (Alt Text: `image`)
- `{{#d.hasImages.indicator.seal_and_bolt}}` ... `{{/d.hasImages.indicator.seal_and_bolt}}` (Alt Text: `image`)
- `{{#d.hasImages.indicator.buttons}}` ... `{{/d.hasImages.indicator.buttons}}` (Alt Text: `image`)
- `{{#d.hasImages.indicator.junction_wiring}}` ... `{{/d.hasImages.indicator.junction_wiring}}` (Alt Text: `image`)
- `{{#d.hasImages.indicator.serial_converter_plug}}` ... `{{/d.hasImages.indicator.serial_converter_plug}}` (Alt Text: `image`)

**Jbox, Sensor, Foundation, Cleanliness** - мөн адил бүтэц.

## 📝 Тайлбар

### Loop бүтэц (Арга 1 - Динамик):

1. **Condition placeholder** (`{{#d.hasImages.exterior.sensor_base}}`) нь **paragraph дээр** оруулах хэрэгтэй
2. **Loop placeholder** (`{{#d.images.exterior.sensor_base}}`) нь **paragraph дээр** оруулах хэрэгтэй
3. **Placeholder зурагийн Alt Text Description = `image`** (placeholder биш, зөвхөн `image` гэж бичих!)
4. Loop нь зураг бүрийн хувьд placeholder зурагийг давтана

### Index placeholder (Арга 2 - Тогтмол):

1. **Condition placeholder** (`{{#d.hasImages.exterior}}`) нь document content дээр (paragraph) оруулах хэрэгтэй
2. **Image placeholder** (`{{d.images.exterior.0}}`) нь зургийн Alt Text дээр оруулах хэрэгтэй
3. Loop синтакс (`{{#d.images.exterior}}...{{/d.images.exterior}}`) нь Alt Text дээр ажиллахгүй

## 🔧 Backend код

Backend кодод зурагуудыг section + field-ээр бүлэглэж, `d.images.exterior.sensor_base`, `d.images.indicator.led_display` гэх мэт массив хэлбэрээр дамжуулж байна. 

Мөн `d.hasImages.exterior.sensor_base`, `d.hasImages.indicator.led_display` гэх мэт boolean утга дамжуулж байгаа тул condition placeholder ашиглах боломжтой.

**Жишээ:** `d.images.exterior.sensor_base` массив нь:
```javascript
[
  { _type: 'image', source: Buffer, format: MimeType.Jpeg, width: 500, height: 400 },
  { _type: 'image', source: Buffer, format: MimeType.Jpeg, width: 500, height: 400 },
  // ... бусад зурагууд
]
```

Loop бүтэц (`{{#d.images.exterior.sensor_base}}...{{/d.images.exterior.sensor_base}}`) нь энэ массивын элемент бүрийн хувьд placeholder зурагийг давтана.

## ⚠️ Чухал: Loop vs Index placeholder

- **Loop бүтэц** (`{{#d.images.exterior.sensor_base}}` + Alt Text: `image`) - Динамик тооны зураг, **ЗӨВЛӨМЖЛӨХ**
- **Index placeholder** (`{{d.images.exterior.0}}` Alt Text дээр) - Тогтмол тооны зураг, зөвхөн зураг тоо тогтмол үед





