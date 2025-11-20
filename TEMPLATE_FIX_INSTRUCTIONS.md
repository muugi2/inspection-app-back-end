# Word Template Fix - Гарын авлага

## Асуудлын шалтгаан

Word документ дотор placeholder-уудыг форматласан үед (жишээ нь: bold, italic, өнгө), Word нь тэдгээрийг хэд хэдэн XML text node-д хуваадаг. Үүний улмаас template processing library-үүд алдаа гаргадаг.

## Шийдэл: Template-ийг гараар засах

### Алхам 1: Template файлыг нээх

1. `templates/template.docx` файлыг Microsoft Word-д нээнэ үү
2. **Ctrl+H** дарж Find & Replace цонхыг нээнэ үү

### Алхам 2: Бүх placeholder-ийг харуулах

1. Find цонхонд: `{{*}}`  бичээд **Find All** дарна
2. Энэ нь бүх placeholder-уудыг тэмдэглэнэ

### Алхам 3: Format устгах

**Хувилбар А - Хялбар арга (Recommended):**

Placeholder бүрийн хувьд:
1. Placeholder-ийг **бүхэлд нь** сонгоно (жишээ нь: `{{d.contractor.company}}`)
2. **Ctrl+Spacebar** дарж format устгана (эсвэл Ribbon дээрх "Clear Formatting" дарна)
3. Placeholder-ийг устгаад **format-гүйгээр** дахин бичнэ

**Хувилбар Б - Бүгдийг нэг дор:**

1. **Ctrl+A** дарж бүх контентыг сонгоно
2. **Ctrl+Spacebar** дарж format устгана
3. Файлыг хадгална

### Алхам 4: Placeholder list

Дараах placeholder-ууд зөв байх ёстой (format-гүйгээр):

**Contractor:**
- `{{d.contractor.company}}`
- `{{d.contractor.contract_no}}`
- `{{d.contractor.contact}}`

**Metadata:**
- `{{d.metadata.date}}`
- `{{d.metadata.inspector}}`
- `{{d.metadata.location}}`
- `{{d.metadata.scale_id_serial_no}}`
- `{{d.metadata.model}}`

**Exterior section:**
- `{{d.exterior.sensor_base.status}}`
- `{{d.exterior.sensor_base.comment}}`
- `{{d.exterior.beam.status}}`
- `{{d.exterior.beam.comment}}`
- (бусад fields...)

**Зургийн loop-ууд:**
```
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
{{#d.images.exterior.sensor_base}}
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

### Алхам 5: Хадгалах ба шалгах

1. Файлыг хадгална
2. Backend дахь түүвэр route-ийг дахин туршина:
   ```
   GET /api/documents/answers/:answerId/docx
   ```

## Техникийн шийдэл

Хэрэв гараар засахыг хүсэхгүй бол:

1. **Docxtemplater ашиглах** (одоо ашиглаж байна - text placeholder зөв ажиллах ёстой)
2. **Easy-template-x-ийн fixRawXml** нэмж өгсөн (зарим тохиолдолд ажиллахгүй)

## Тэмдэглэл

- Зургийн placeholder-уудын хувьд image module хэрэгтэй (төлбөртэй)
- Эсвэл зургийг HTML template ашиглан нэмж болно
- Миний санал: Эхлээд text placeholder-уудыг ажиллуулаад, дараа нь зургийг нэмэх




