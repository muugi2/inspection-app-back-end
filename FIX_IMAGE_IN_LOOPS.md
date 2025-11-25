# Loop-ийн Дотор Зураг Орлуулах Асуудлын Засвар

## Асуудал

Easy-template-x нь loop-ийг боловсруулж байгаа ч, loop-ийн дотор зураг placeholder-ийг олж, орлуулахгүй байна.

## Шалтгаан

Easy-template-x-ийн documentation-д loop-ийн дотор зураг placeholder орлуулах талаар дурдаагүй байна. README-д зөвхөн:
- **Text tag replacement** - inline images
- **Image placeholder replacement** - Alt Text дээр tag оруулах

Loop-ийн дотор зураг placeholder орлуулах нь дэмжигдэхгүй байж магадгүй.

## Шийдэл 1: Loop-ийн Дотор Зураг Placeholder-ийн Alt Text Засах (ТУРШИХ)

**Магадгүй асуудал:** Loop-ийн дотор зураг placeholder-ийн Alt Text зөв биш байж магадгүй.

**Одоогийн бүтэц:**
- Alt Text Description = `image`

**Засвар:**
- Alt Text Description = `{{d.images.exterior.sensor_base}}` (loop-ийн tag-тэй ижил)

**Template бүтэц:**

```
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
{{#d.images.exterior.sensor_base}}
[Placeholder зураг - Alt Text: {{d.images.exterior.sensor_base}}]
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

**Анхаар:** Энэ нь ажиллахгүй байж магадгүй, учир нь loop-ийн дотор зураг placeholder орлуулах нь дэмжигдэхгүй байж магадгүй.

## Шийдэл 2: Loop-ийн Гадна Index Placeholder Ашиглах (ПРАКТИК ШИЙДЭЛ)

Loop-ийн оронд index placeholder ашиглах. Гэхдээ энэ нь зураг тоо тогтмол биш үед асуудалтай.

**Template бүтэц:**

```
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
[Placeholder зураг 1 - Alt Text: {{d.images.exterior.sensor_base.0}}]
[Placeholder зураг 2 - Alt Text: {{d.images.exterior.sensor_base.1}}]
[Placeholder зураг 3 - Alt Text: {{d.images.exterior.sensor_base.2}}]
{{/d.hasImages.exterior.sensor_base}}
```

**Backend код засах:**

```javascript
// routes/documents.js - groupImagesBySectionAndField-ийн дараа

// Index placeholder-д зориулж template data-ийг өөрчлөх
Object.keys(imagesBySectionField).forEach((key) => {
  const [section, fieldId] = key.split('.');
  const images = imagesBySectionField[key];
  
  if (fieldMappings[section] && fieldMappings[section][fieldId]) {
    const fieldKey = fieldMappings[section][fieldId];
    
    // Index placeholder-д зориулж
    images.forEach((image, index) => {
      const indexKey = `d.images.${section}.${fieldKey}.${index}`;
      templateData[indexKey] = image;
      
      // Nested structure
      if (!templateData.d.images[section]) {
        templateData.d.images[section] = {};
      }
      if (!templateData.d.images[section][fieldKey]) {
        templateData.d.images[section][fieldKey] = [];
      }
      templateData.d.images[section][fieldKey][index] = image;
    });
  }
});
```

**Асуудал:** Зураг тоо тогтмол биш үед энэ арга ажиллахгүй.

## Шийдэл 3: Loop-ийн Дотор Text Tag Ашиглах (ТУРШИХ)

Loop-ийн дотор text tag ашиглах. Гэхдээ энэ нь зураг бүрийн хувьд ижил tag ашиглах шаардлагатай.

**Template бүтэц:**

```
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
{{#d.images.exterior.sensor_base}}
{{image}}  <!-- Text tag -->
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

**Backend код засах:**

```javascript
// routes/documents.js - template data-д нэмэх

// Loop-ийн дотор text tag-д зориулж
templateData.image = imagesBySectionField['exterior.sensor_base']?.[0] || null;
```

**Асуудал:** Энэ нь зөвхөн эхний зураг ашиглана, бусад зурагууд ашиглахгүй.

## Шийдэл 4: Custom Plugin Бичих (УРТ ХУГАЦААНЫ ШИЙДЭЛ)

Easy-template-x-ийн custom plugin бичиж, loop-ийн дотор зураг placeholder орлуулах логикийг өөрөө хэрэгжүүлэх.

**Алхам:**

1. Custom plugin бичих
2. Loop-ийн дотор зураг placeholder-ийг олох
3. Template data-аас зурагуудыг авч, placeholder-ийг орлуулах

**Жишээ:**

```javascript
// custom-image-in-loop-plugin.js
const { Plugin } = require('easy-template-x');

class ImageInLoopPlugin extends Plugin {
  constructor() {
    super('imageInLoop');
  }

  async process(context) {
    // Loop-ийн дотор зураг placeholder-ийг олох
    // Template data-аас зурагуудыг авч, placeholder-ийг орлуулах
  }
}
```

## Шийдэл 5: Docxtemplater Ашиглах (ӨӨР LIBRARY)

Easy-template-x-ийн оронд Docxtemplater ашиглах. Docxtemplater нь loop-ийн дотор зураг placeholder орлуулахыг дэмждэг.

**Алхам:**

1. Docxtemplater суулгах
2. Template-ийг Docxtemplater-ийн формат руу хөрвүүлэх
3. Backend код засах

## ЗӨВЛӨМЖ

### Эхний Алхам: Template Бүтэц Шалгах

1. **Template-ийн бүтэц шалгах:**
   - Loop-ийн дотор зураг placeholder paragraph-ийн дотор байгаа эсэх
   - Зураг placeholder-ийн Alt Text зөв эсэх

2. **Template data бүтэц шалгах:**
   - Loop-ийн дотор зураг placeholder-ийг орлуулахдаа nested structure ашиглах эсэх

### Хоёрдугаар Алхам: Шийдэл 1 Турших

Шийдэл 1-ийг турших - loop-ийн дотор зураг placeholder-ийн Alt Text засах.

### Гуравдугаар Алхам: Шийдэл 2 Турших

Шийдэл 2-ийг турших - loop-ийн гадна index placeholder ашиглах. Гэхдээ энэ нь зураг тоо тогтмол биш үед асуудалтай.

### Дөрөвдүгээр Алхам: Шийдэл 4 эсвэл Шийдэл 5

Хэрэв дээрх шийдлүүд ажиллахгүй бол:
- Шийдэл 4: Custom plugin бичих
- Шийдэл 5: Docxtemplater ашиглах

## Дүгнэлт

**Хамгийн магадлалтай шалтгаан:**
- Easy-template-x нь loop-ийн дотор зураг placeholder орлуулахыг дэмжихгүй байна

**Дараагийн алхмууд:**
1. Template-ийн бүтэц шалгах (Alt Text зөв эсэх)
2. Шийдэл 1 турших (Alt Text засах)
3. Шийдэл 2 турших (Index placeholder ашиглах)
4. Хэрэв ажиллахгүй бол Шийдэл 4 эсвэл Шийдэл 5






