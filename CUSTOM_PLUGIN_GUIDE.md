# Easy-Template-X Custom Plugin Бичих Заавар

## 🎯 Зорилго

Easy-template-x-ийн custom plugin бичиж, loop-ийн дотор зурагуудыг 3 баганатай grid layout-д байрлуулах.

## 📋 Шаардлагатай Зүйлс

### 1. **Мэдлэг:**
- JavaScript/TypeScript
- Easy-template-x-ийн plugin API
- DOCX файлын XML бүтэц
- Word-ийн хүснэгтийн XML бүтэц

### 2. **Tools:**
- Node.js
- Easy-template-x library (аль хэдийн суулгасан)
- JSZip (DOCX файлыг унших/бичих)

### 3. **Файлууд:**
- `utils/gridLayoutPlugin.js` - Custom plugin файл
- `routes/documents.js` - Plugin-ийг ашиглах

## 📐 Plugin API

Easy-template-x-ийн `TemplatePlugin` abstract class:

```typescript
abstract class TemplatePlugin {
  abstract readonly contentType: string;
  protected utilities: PluginUtilities;
  
  setUtilities(utilities: PluginUtilities): void;
  
  // Simple tag-уудыг орлуулах (жишээ: {{text}})
  simpleTagReplacements(
    tag: Tag, 
    data: ScopeData, 
    context: TemplateContext
  ): void | Promise<void>;
  
  // Container tag-уудыг орлуулах (жишээ: {{#loop}}...{{/loop}})
  containerTagReplacements(
    tags: Tag[], 
    data: ScopeData, 
    context: TemplateContext
  ): void | Promise<void>;
}
```

## 🔧 Custom Plugin Бичих

### Алхам 1: Plugin Файл Үүсгэх

`utils/gridLayoutImagePlugin.js` файл үүсгэх:

```javascript
const { TemplatePlugin } = require('easy-template-x');
const { Tag, ScopeData, TemplateContext } = require('easy-template-x');

class GridLayoutImagePlugin extends TemplatePlugin {
  constructor() {
    super();
    this.contentType = 'gridLayoutImage';
  }

  /**
   * Container tag-уудыг орлуулах (loop-ийн хувьд)
   * Энэ нь loop-ийн дотор зурагуудыг grid layout-д байрлуулах
   */
  async containerTagReplacements(tags, data, context) {
    // tags - loop-ийн tag-ууд (эхлэх болон дуусгах tag)
    // data - template data (ScopeData)
    // context - template context (TemplateContext)
    
    // 1. Loop-ийн дотор зураг placeholder-ийг олох
    // 2. Template data-аас зурагуудыг авч
    // 3. Хүснэгтийн нүд бүрт зурагуудыг байрлуулах
    
    // Энэ нь маш төвөгтэй, учир нь:
    // - DOCX XML бүтцийг ойлгох хэрэгтэй
    // - Хүснэгтийн нүд бүрт зурагуудыг байрлуулах хэрэгтэй
    // - Loop-ийн доторх бүх content-ийг хүснэгтийн нүд бүрт хуваах хэрэгтэй
  }
}

module.exports = { GridLayoutImagePlugin };
```

### Алхам 2: Plugin-ийг TemplateHandler-д Нэмэх

`routes/documents.js` файлд:

```javascript
const { TemplateHandler, MimeType } = require('easy-template-x');
const { GridLayoutImagePlugin } = require('../utils/gridLayoutImagePlugin');

// TemplateHandler үүсгэхдээ plugin нэмэх
const templateHandler = new TemplateHandler({
  delimiters: {
    tagStart: '{{',
    tagEnd: '}}',
    containerTagOpen: '#',
    containerTagClose: '/',
  },
  fixRawXml: true,
  maxXmlDepth: 25,
  plugins: [
    // Default plugins-ийг хадгална
    ...require('easy-template-x').createDefaultPlugins(),
    // Custom plugin нэмэх
    new GridLayoutImagePlugin(),
  ],
});
```

## ⚠️ Боломжтой Барьцаа

### 1. **DOCX XML Бүтэц**
- DOCX файл нь ZIP архив бөгөөд XML файлууд агуулна
- Хүснэгтийн бүтэц нь маш төвөгтэй
- Зурагуудыг хүснэгтийн нүд бүрт байрлуулах нь XML-ийг шууд засах шаардлагатай

### 2. **Easy-Template-X-ийн Хязгаарлалт**
- Plugin API нь loop-ийн доторх content-ийг хүснэгтийн нүд бүрт хуваахыг дэмжихгүй байж магадгүй
- Loop plugin нь content-ийг давтана, гэхдээ хүснэгтийн бүтцийг хадгална

### 3. **Хэрэгжүүлэх Хэцүү Байдал**
- DOCX XML бүтцийг бүрэн ойлгох хэрэгтэй
- Хүснэгтийн нүд бүрт зурагуудыг байрлуулах логик бичих хэрэгтэй
- Relationship файлуудыг зөв засах хэрэгтэй (зурагууд media файл болно)

## 🔄 Өөр Шийдлүүд

### Шийдэл 1: Post-Processing (Илүү Практик)

Template боловсруулсны дараа DOCX файлыг уншиж, зурагуудыг grid layout-д байрлуулах:

```javascript
async function rearrangeImagesInGridLayout(docxBuffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(docxBuffer);
  const xml = await zip.file('word/document.xml').async('string');
  
  // 1. Хүснэгт олох (3 баганатай)
  // 2. Зурагуудыг олох (эхний нүд дотор)
  // 3. Зурагуудыг хүснэгтийн нүд бүрт байрлуулах
  // 4. XML-ийг засах
  // 5. DOCX файлыг дахин үүсгэх
  
  // Энэ нь маш төвөгтэй, учир нь:
  // - XML бүтцийг бүрэн ойлгох хэрэгтэй
  // - Relationship файлуудыг зөв засах хэрэгтэй
}
```

### Шийдэл 2: Template Бүтцийг Өөрчлөх

Template-д loop placeholder-ийг хүснэгтийн галуун байрлуулах (турших):

```
{{#d.hasImages.exterior.sensor_base}}

┌──────────────┬──────────────┬──────────────┐
│              │              │              │
└──────────────┴──────────────┴──────────────┘

{{#d.images.exterior.sensor_base}}
[Placeholder зураг - Alt Text: image]
{{/d.images.exterior.sensor_base}}

{{/d.hasImages.exterior.sensor_base}}
```

## 📚 Нэмэлт Мэдээлэл

### Easy-Template-X Plugin API:
- `TemplatePlugin` - Abstract class
- `simpleTagReplacements()` - Simple tag-уудыг орлуулах
- `containerTagReplacements()` - Container tag-уудыг орлуулах
- `contentType` - Plugin-ийн төрөл

### DOCX XML Бүтэц:
- `word/document.xml` - Үндсэн агуулга
- `word/_rels/document.xml.rels` - Relationship файл
- `word/media/` - Зурагууд хадгалагдаж байгаа газар

## ✅ Дүгнэлт

Custom plugin бичих нь:
- ✅ Техникийн хувьд боломжтой
- ❌ Маш төвөгтэй (DOCX XML бүтцийг бүрэн ойлгох хэрэгтэй)
- ❌ Их цаг хугацаа шаардана
- ❌ Тест хийх хэцүү

**Зөвлөмж:** Post-processing эсвэл template бүтцийг өөрчлөх нь илүү практик байж магадгүй.


