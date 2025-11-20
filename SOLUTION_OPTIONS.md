# Easy-Template-X Loop-ийн Дотор Зураг Орлуулах Асуудлын Шийдлүүд

## Асуудал

Easy-template-x нь loop-ийг боловсруулж байгаа ч, loop-ийн дотор зураг placeholder-ийг олж, орлуулахгүй байна.

## Шалгасан Зүйлс

✅ Бүх pipeline алхмууд амжилттай:
- FTP Server → Base64 хөрвүүлэлт
- Database → Image Objects
- Image object structure зөв (_type, source, format, width, height)
- Template data structure зөв (flattened + nested)
- Template файл зөв (4 loop, бүх loop-д зураг placeholder)

❌ Easy-template-x нь loop-ийн дотор зураг placeholder-ийг орлуулахгүй байна.

## Боломжит Шийдлүүд

### ✅ Шийдэл 1: Loop-ийн Дотор Text Tag Ашиглах (ЗӨВЛӨМЖЛӨХ)

Easy-template-x-ийн documentation-д loop-ийн дотор зураг placeholder орлуулах талаар дурдаагүй байна. Гэхдээ **text tag replacement** нь loop-ийн дотор ажилладаг.

**Өөрчлөлт:**

1. **Template-д:** Loop-ийн дотор зураг placeholder-ийн оронд **text tag** ашиглах
2. **Backend код:** Хэвээр байна (image object structure ижил)

**Template бүтэц:**

```
{{#d.hasImages.exterior.sensor_base}}
Мэдрэгчийн суурь:
{{#d.images.exterior.sensor_base}}
{{image}}  <!-- Text tag, placeholder биш -->
{{/d.images.exterior.sensor_base}}
{{/d.hasImages.exterior.sensor_base}}
```

**Template data:**

```javascript
{
  d: {
    images: {
      exterior: {
        sensor_base: [
          {
            _type: 'image',
            source: Buffer,
            format: MimeType.Jpeg,
            width: 300,
            height: 200
          }
        ]
      }
    }
  },
  // Text tag-д зориулж
  image: {
    _type: 'image',
    source: Buffer,
    format: MimeType.Jpeg,
    width: 300,
    height: 200
  }
}
```

**Асуудал:** Loop-ийн дотор text tag ашиглах нь зураг бүрийн хувьд ижил tag-ийг ашиглах шаардлагатай. Энэ нь loop-ийн дотор динамик tag ашиглах боломжгүй гэсэн үг.

### ✅ Шийдэл 3: Loop-ийн Дотор  
Template-ийн бүтцийг засах - loop-ийн дотор зураг placeholder-ийн бүтцийг шалгах.

**Магадгүй асуудал:**
- Зураг placeholder loop-ийн дотор paragraph-ийн дотор байх ёстой
- Зураг placeholder-ийн Alt Text зөв байх ёстой (`image` биш, `{{tag}}` байх ёстой)
- Зураг placeholder-ийн бүтэц signature image-тай ижил байх ёстой

**Шалгах зүйлс:**

1. **Template-ийн бүтэц шалгах:**
   - Loop-ийн дотор зураг placeholder paragraph-ийн дотор байгаа эсэх
   - Зураг placeholder-ийн Alt Text зөв эсэх

2. **Template data бүтэц шалгах:**
   - Loop-ийн дотор зураг placeholder-ийг орлуулахдаа nested structure ашиглах эсэх
   - Магадгүй flattened keys ашиглах ёстой

### ✅ Шийдэл 5: Custom Plugin Бичих

Easy-template-x-ийн custom plugin бичиж, loop-ийн дотор зураг placeholder орлуулах логикийг өөрөө хэрэгжүүлэх.

**Алхам:**

1. Custom plugin бичих
2. Loop-ийн дотор зураг placeholder-ийг олох
3. Template data-аас зурагуудыг авч, placeholder-ийг орлуулах

**Асуудал:** Энэ нь их ажил шаардана.

### Хоёрдугаар Алхам: Easy-Template-X Source Code Шалгах

Easy-template-x-ийн source code-ийг шалгаж, loop-ийн дотор зураг placeholder орлуулах логикийг ойлгох.

### Гуравдугаар Алхам: Шийдэл 1 Турших

Шийдэл 1-ийг турших - loop-ийн дотор text tag ашиглах. Гэхдээ энэ нь зураг бүрийн хувьд ижил tag ашиглах шаардлагатай тул ажиллахгүй байж магадгүй.

### Дөрөвдүгээр Алхам: Шийдэл 3 Турших

Шийдэл 3-ийг турших - template-ийн бүтцийг засах. Loop-ийн дотор зураг placeholder-ийн бүтцийг шалгах.

## Дүгнэлт

**Хамгийн магадлалтай шалтгаан:**
- Easy-template-x нь loop-ийн дотор зураг placeholder орлуулахыг дэмжихгүй байж магадгүй
- Магадгүй template-ийн бүтэц эсвэл template data-ийн бүтэц буруу байж магадгүй

**Дараагийн алхмууд:**
1. Template-ийн бүтэц шалгах
2. Easy-template-x-ийн source code шалгах
3. Шийдэл 1 эсвэл Шийдэл 3 турших




