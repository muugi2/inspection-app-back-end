const express = require('express');
const path = require('path');
const fs = require('fs');
const { TemplateHandler, MimeType } = require('easy-template-x');
const sharp = require('sharp');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const MIME_TYPE_MAP = {
  'image/png': MimeType.Png,
  'image/jpeg': MimeType.Jpeg,
  'image/jpg': MimeType.Jpeg,
  'image/gif': MimeType.Gif,
  'image/bmp': MimeType.Bmp,
  'image/svg+xml': MimeType.Svg,
};
const SUPPORTED_IMAGE_MIME_TYPES = new Set(Object.keys(MIME_TYPE_MAP));

// Зурагийн хэмжээ тохиргоо (environment variable эсвэл default утга)
const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH) || 150; // Default: 150px
const IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT) || 200; // Default: 200px

async function convertUnsupportedImage(buffer, originalMimeType) {
  try {
    console.log(
      '[documents] Converting unsupported image type:',
      originalMimeType
    );
    // EXIF orientation-ийг засах, PNG руу хөрвүүлэх
    const convertedBuffer = await sharp(buffer)
      .autoOrient() // EXIF orientation-ийг автоматаар засах
      .png()
      .toBuffer();
    return {
      buffer: convertedBuffer,
      mimeType: 'image/png',
      format: MimeType.Png,
    };
  } catch (error) {
    console.error(
      '[documents] ❌ Failed to convert image to PNG:',
      originalMimeType,
      error.message
    );
    return null;
  }
}

async function createImageContent(imageData) {
  console.log('[documents] createImageContent called with:', {
    hasImageData: !!imageData,
    isObject: imageData && typeof imageData === 'object',
    hasBase64: !!(imageData && imageData.base64),
    hasMimeType: !!(imageData && imageData.mimeType),
    base64Length: imageData?.base64?.length,
    mimeType: imageData?.mimeType,
    section: imageData?.section,
    fieldId: imageData?.fieldId,
  });

  if (
    !imageData ||
    typeof imageData !== 'object' ||
    !imageData.base64 ||
    !imageData.mimeType
  ) {
    console.warn('[documents] ❌ Invalid imageData:', {
      imageData: imageData ? 'exists' : 'null',
      hasBase64: !!(imageData && imageData.base64),
      hasMimeType: !!(imageData && imageData.mimeType),
    });
    return null;
  }

  let normalizedType = imageData.mimeType.toLowerCase();
  let format = MIME_TYPE_MAP[normalizedType];

  // Detailed format validation
  // Note: MimeType enum values are strings in easy-template-x
  const formatCheck = {
    originalMimeType: imageData.mimeType,
    normalizedType,
    format,
    formatType: typeof format,
    formatValue: format,
    formatIsUndefined: format === undefined,
    formatIsNull: format === null,
    isMimeTypeEnum: format === MimeType.Png || format === MimeType.Jpeg || format === MimeType.Gif || format === MimeType.Bmp || format === MimeType.Svg,
    formatName: format === MimeType.Png ? 'Png' : format === MimeType.Jpeg ? 'Jpeg' : format === MimeType.Gif ? 'Gif' : format === MimeType.Bmp ? 'Bmp' : format === MimeType.Svg ? 'Svg' : 'Other',
    MIME_TYPE_MAP_keys: Object.keys(MIME_TYPE_MAP),
    MIME_TYPE_MAP_hasKey: normalizedType in MIME_TYPE_MAP,
    MimeTypeEnumValues: {
      Png: MimeType.Png,
      Jpeg: MimeType.Jpeg,
      Gif: MimeType.Gif,
      Bmp: MimeType.Bmp,
      Svg: MimeType.Svg,
    },
  };

  console.log('[documents] Image format mapping:', formatCheck);

  // If format is undefined or not a MimeType enum, this is a problem
  // Note: MimeType enum values are strings, not numbers
  if (format === undefined || format === null || !formatCheck.isMimeTypeEnum) {
    console.error('[documents] ❌ FORMAT ERROR:', {
      formatIsUndefined: format === undefined,
      formatIsNull: format === null,
      formatIsNotEnum: !formatCheck.isMimeTypeEnum,
      formatType: typeof format,
      formatValue: format,
      expectedType: 'MimeType enum (string)',
      actualType: typeof format,
      normalizedType,
      MIME_TYPE_MAP_hasKey: normalizedType in MIME_TYPE_MAP,
      expectedFormat: MIME_TYPE_MAP[normalizedType],
    });
  }

  try {
    // Validate base64 string
    if (typeof imageData.base64 !== 'string') {
      console.error('[documents] ❌ Base64 is not a string:', typeof imageData.base64);
      return null;
    }

    if (imageData.base64.length === 0) {
      console.error('[documents] ❌ Base64 string is empty');
      return null;
    }

    // Check if base64 string looks valid (starts with valid base64 chars)
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (!base64Pattern.test(imageData.base64)) {
      console.error('[documents] ❌ Base64 string contains invalid characters');
      console.error('[documents] First 100 chars:', imageData.base64.substring(0, 100));
      return null;
    }

    console.log('[documents] Converting base64 to Buffer...', {
      base64Length: imageData.base64.length,
      estimatedBufferSize: Math.ceil(imageData.base64.length * 3 / 4),
    });

    let source = Buffer.from(imageData.base64, 'base64');

    if (!format) {
      const converted = await convertUnsupportedImage(
        source,
        normalizedType || 'unknown'
      );
      if (!converted) {
        return null;
      }
      source = converted.buffer;
      format = converted.format;
      normalizedType = converted.mimeType;
    }
    
    if (!source || source.length === 0) {
      console.error('[documents] ❌ Buffer is empty after conversion');
      return null;
    }

    // EXIF orientation-ийг засах болон зурагийн хэмжээг тохируулах
    // Sharp-ийн autoOrient() нь EXIF orientation data-г уншиж, зурагийг зөв байрлуулна
    let finalWidth = IMAGE_WIDTH;
    let finalHeight = IMAGE_HEIGHT;
    
    try {
      const sharpImage = sharp(source);
      const metadata = await sharpImage.metadata();
      
      console.log('[documents] Image metadata:', {
        width: metadata.width,
        height: metadata.height,
        orientation: metadata.orientation,
        format: metadata.format,
      });
      
      // EXIF orientation байвал засах
      if (metadata.orientation && metadata.orientation !== 1) {
        console.log('[documents] Fixing image orientation:', {
          originalOrientation: metadata.orientation,
          originalWidth: metadata.width,
          originalHeight: metadata.height,
        });
        
        // autoOrient() нь EXIF orientation-ийг уншиж, зурагийг зөв байрлуулна
        // Мөн resize хийж, хэмжээг тохируулах
        source = await sharpImage
          .autoOrient() // EXIF orientation-ийг автоматаар засах
          .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
            fit: 'inside', // Хэмжээг хадгалж, дотор нь байрлуулах
            withoutEnlargement: true, // Жижиг зурагуудыг томруулахгүй
          })
          .toBuffer();
        
        console.log('[documents] ✅ Image orientation fixed and resized');
      } else {
        // Orientation зөв байвал зөвхөн resize хийх
        console.log('[documents] Image orientation is correct, resizing...');
        source = await sharpImage
          .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();
        
        console.log('[documents] ✅ Image resized');
      }
    } catch (orientationError) {
      console.warn('[documents] ⚠️ Could not process image with sharp:', orientationError.message);
      // Алдаа гарвал анхны buffer-ийг ашиглах
    }

    console.log('[documents] ✅ Buffer created successfully:', {
      bufferLength: source.length,
      format,
      formatType: typeof format,
      formatValue: format,
      isMimeTypeEnum: format === MimeType.Png || format === MimeType.Jpeg || format === MimeType.Gif || format === MimeType.Bmp || format === MimeType.Svg,
      formatName: format === MimeType.Png ? 'Png' : format === MimeType.Jpeg ? 'Jpeg' : format === MimeType.Gif ? 'Gif' : format === MimeType.Bmp ? 'Bmp' : format === MimeType.Svg ? 'Svg' : 'Other',
      width: finalWidth,
      height: finalHeight,
      isBuffer: Buffer.isBuffer(source),
      sourceType: typeof source,
    });

    return {
      _type: 'image',
      source, // Buffer object - easy-template-x will use this directly
      format,
      width: finalWidth, // Section зурагуудын өргөн (configurable, orientation зассны дараа)
      height: finalHeight, // Section зурагуудын өндөр (configurable, orientation зассны дараа)
    };
  } catch (error) {
    console.error(
      '[documents] ❌ Failed to build image:',
      error.message,
      error.stack
    );
    return null;
  }
}

function createSignatureImageContent(signature) {
  if (
    !signature ||
    typeof signature !== 'object' ||
    !signature.data ||
    !signature.mimeType
  ) {
    return null;
  }

  const normalizedType = signature.mimeType.toLowerCase();
  const format = MIME_TYPE_MAP[normalizedType] || MimeType.Png;

  try {
    const source = Buffer.from(signature.data, 'base64');
    if (!source.length) {
      return null;
    }

    return {
      _type: 'image',
      source, // Buffer object - easy-template-x will use this directly
      format,
      width: 180, // Гарын үсгийн өргөн
      height: 80, // Гарын үсгийн өндөр
    };
  } catch (error) {
    console.warn(
      '[documents] Failed to build signature image:',
      error.message
    );
    return null;
  }
}

/**
 * Хоосон placeholder зураг үүсгэх (grid layout-д хоосон байрлуулахын тулд)
 * 1x1 transparent PNG ашиглаж, хэмжээг бодит зурагуудтай ижил болгоно
 */
function createEmptyPlaceholderImage(width = IMAGE_WIDTH, height = IMAGE_HEIGHT) {
  // 1x1 transparent PNG (base64)
  // Энэ нь хамгийн жижиг transparent PNG байна
  const transparentPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  try {
    const source = Buffer.from(transparentPngBase64, 'base64');
    
    return {
      _type: 'image',
      source,
      format: MimeType.Png,
      width,
      height,
      isEmpty: true, // Хоосон placeholder гэдгийг тэмдэглэх
    };
  } catch (error) {
    console.warn('[documents] Failed to create empty placeholder image:', error.message);
    return null;
  }
}

/**
 * Post-processing: Easy-template-x боловсруулсны дараа зурагуудыг grid layout-д байрлуулах
 * Зурагууд зөвхөн зүүн талын баганад доошоо цувран байгаа тул, тэдгээрийг 3 баганатай grid layout-д байрлуулах
 */
async function rearrangeImagesInGridLayout(docxBuffer) {
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(docxBuffer);
    const xml = await zip.file('word/document.xml').async('string');
    
    console.log('[documents] Post-processing: Rearranging images in grid layout...');
    
    // Хүснэгт олох (3 баганатай хүснэгт)
    // Loop placeholder-ийн дотор байрлах хүснэгтийг олох
    // Зурагууд зөвхөн эхний нүд дотор байрлаж байгаа тул, тэдгээрийг grid layout-д байрлуулах
    
    // Энэ нь маш төвөгтэй байж магадгүй, учир нь:
    // 1. Хүснэгтийн бүтцийг ойлгох хэрэгтэй
    // 2. Зурагуудыг олох хэрэгтэй
    // 3. Зурагуудыг хүснэгтийн нүд бүрт байрлуулах хэрэгтэй
    
    // Одоогоор энэ функц нь placeholder байна
    // Ирээдүйд хэрэгжүүлэх боломжтой
    
    console.log('[documents] Post-processing: Grid layout rearrangement is not yet implemented');
    console.log('[documents] Images are currently placed in the first column only');
    
    return docxBuffer; // Одоогоор өөрчлөлтгүй буцаана
  } catch (error) {
    console.warn('[documents] Post-processing error:', error.message);
    return docxBuffer; // Алдаа гарвал анхны buffer-ийг буцаана
  }
}


async function groupImagesBySectionAndField(images) {
  // Section + field бүрийн зурагуудыг бүлэглэх
  const grouped = {};

  if (!Array.isArray(images)) {
    return grouped;
  }

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    const section = image.section;
    const fieldId = image.fieldId;
    
    console.log(`[documents] Processing image ${index + 1}/${images.length}:`, {
      section,
      fieldId,
      hasBase64: !!image.base64,
      base64Length: image.base64?.length,
      mimeType: image.mimeType,
    });
    
    if (section && fieldId) {
      const key = `${section}.${fieldId}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      const imageContent = await createImageContent(image);
      if (imageContent) {
        console.log(`[documents] ✅ Image content created for ${key}`);
        grouped[key].push(imageContent);
      } else {
        console.warn(`[documents] ❌ Failed to create image content for ${key}`, {
          section,
          fieldId,
          hasBase64: !!image.base64,
          mimeType: image.mimeType,
        });
      }
    } else {
      console.warn(`[documents] ❌ Image missing section or fieldId:`, {
        section,
        fieldId,
        imageId: image.id,
      });
    }
  }

  return grouped;
}
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { buildInspectionReportData } = require('../services/report-service');

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Buffer)
  );
}

function flattenTemplateFields(value, prefix = '', result = {}) {
  if (!isPlainObject(value)) {
    return result;
  }

  Object.entries(value).forEach(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      result[nextKey] = entry ?? '';
      return;
    }

    if (isPlainObject(entry)) {
      flattenTemplateFields(entry, nextKey, result);
    }
    
    // Skip arrays - they will be handled separately for images
    if (Array.isArray(entry)) {
      // Don't flatten arrays, keep them as is
      result[nextKey] = entry;
    }
  });

  return result;
}

const router = express.Router();
const prisma = new PrismaClient();

// Template handler configuration
const TEMPLATE_HANDLER_OPTIONS = {
  delimiters: {
    tagStart: '{{',
    tagEnd: '}}',
    containerTagOpen: '#',
    containerTagClose: '/',
  },
  // Fix Word's XML formatting that can split placeholders across text nodes
  fixRawXml: true,
  // Increase max XML depth to handle complex documents
  maxXmlDepth: 25,
};

// Create template handler instance
const templateHandler = new TemplateHandler(TEMPLATE_HANDLER_OPTIONS);

// Basic placeholder route to confirm the documents router is mounted
router.get('/', (req, res) => {
  res.json({ message: 'Documents API is available' });
});

const REPORT_TEMPLATE_FILE =
  process.env.REPORT_TEMPLATE_FILE || 'template.docx';

// Preview data for inspection report based on answer ID
router.get('/answers/:answerId/preview', authMiddleware, async (req, res) => {
  try {
    const answerId = BigInt(req.params.answerId);
    const data = await buildInspectionReportData(prisma, { answerId });
    return res.json({ data });
  } catch (error) {
    console.error('Error building inspection preview data:', error);
    return res.status(500).json({
      error: 'Failed to build preview data',
      message: error.message,
    });
  }
});

// Generate DOCX using Docxtemplater (answer ID)
router.get('/answers/:answerId/docx', authMiddleware, async (req, res) => {
  try {
    const answerId = BigInt(req.params.answerId);
    const reportData = await buildInspectionReportData(prisma, { answerId });

    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      REPORT_TEMPLATE_FILE
    );

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        error: 'Template not found',
        message: `Template file ${REPORT_TEMPLATE_FILE} is missing.`,
      });
    }

    const templateFile = fs.readFileSync(templatePath);
    
    // Flatten the d object specifically with 'd' prefix
    const flattenedFields = flattenTemplateFields(reportData.d || {}, 'd');
    console.log('[documents] Flattened fields count:', Object.keys(flattenedFields).length);
    console.log('[documents] Flattened fields sample:', Object.keys(flattenedFields).slice(0, 10));
    console.log('[documents] Sample flattened values:', {
      'd.contractor.company': flattenedFields['d.contractor.company'],
      'd.metadata.date': flattenedFields['d.metadata.date'],
      'd.exterior.sensor_base.status': flattenedFields['d.exterior.sensor_base.status'],
    });
    
    // Create templateData with both nested structure and flattened keys
    // easy-template-x should handle dot-separated keys directly
    const templateData = {
      ...reportData,  // Keep original nested structure
      ...flattenedFields,  // Add flattened keys for dot-separated placeholders
    };
    
    // Also ensure nested structure exists for images (easy-template-x might need both)
    if (!templateData.d) {
      templateData.d = {};
    }
    if (!templateData.d.images) {
      templateData.d.images = {};
    }
    if (!templateData.d.hasImages) {
      templateData.d.hasImages = {};
    }
    
    // Log a few template data keys to verify structure
    console.log('[documents] Template data keys sample:', Object.keys(templateData).slice(0, 15));

    // Signature image
    const inspectorSignature = reportData.d?.signatures?.inspector;
    const inspectorImage = createSignatureImageContent(inspectorSignature);
    if (inspectorImage) {
      templateData['d.signatures.inspector'] = inspectorImage;
    }

    // FTP image (same structure and logic as signature image)
    const ftpImage = reportData.d?.ftp_image;
    const ftpImageContent = createSignatureImageContent(ftpImage);
    if (ftpImageContent) {
      // Use same width/height as signature or customize for FTP image
      ftpImageContent.width = 300; // FTP зурагуудын өргөн
      ftpImageContent.height = 200; // FTP зурагуудын өндөр
      templateData['d.ftp_image'] = ftpImageContent;
      console.log('[documents] Added FTP image to template data');
    } else {
      console.log('[documents] No FTP image found in report data');
    }

    // Group images by section + field_id and add to template data
    const imagesBySectionField = await groupImagesBySectionAndField(
      reportData.d?.images || []
    );
    
    // Field mapping (section -> field_id -> field_key)
    const fieldMappings = {
      exterior: {
        sensor_base: 'sensor_base',
        beam: 'beam',
        platform_plate: 'platform_plate',
        beam_joint_plate: 'beam_joint_plate',
        stop_bolt: 'stop_bolt',
        interplatform_bolts: 'interplatform_bolts',
      },
      indicator: {
        led_display: 'led_display',
        power_plug: 'power_plug',
        seal_bolt: 'seal_bolt',
        buttons: 'buttons',
        junction_wiring: 'junction_wiring',
        serial_converter: 'serial_converter_plug',
      },
      jbox: {
        box_integrity: 'box_integrity',
        collector_board: 'collector_board',
        wire_tightener: 'wire_tightener',
        resistor_element: 'resistor_element',
        protective_box: 'protective_box',
      },
      sensor: {
        signal_wire: 'signal_wire',
        ball: 'ball',
        base: 'base',
        ball_cup_thin: 'ball_cup_thin',
        plate: 'plate',
      },
      foundation: {
        cross_base: 'cross_base',
        anchor_plate: 'anchor_plate',
        ramp_angle: 'ramp_angle',
        ramp_stopper: 'ramp_stopper',
        ramp: 'ramp',
        slab_base: 'slab_base',
      },
      cleanliness: {
        under_platform: 'under_platform',
        top_platform: 'top_platform',
        gap_platform_ramp: 'gap_platform_ramp',
        both_sides_area: 'both_sides_area',
      },
    };

    // Add images arrays for each section.field
    console.log('[documents] Processing images for template...');
    console.log('[documents] Grouped images keys:', Object.keys(imagesBySectionField));
    console.log('[documents] Grouped images details:', 
      Object.entries(imagesBySectionField).map(([key, images]) => ({
        key,
        imageCount: images.length,
        firstImageHasType: images[0]?._type,
        firstImageHasSource: !!images[0]?.source,
      }))
    );
    
    // Initialize all field mappings with empty arrays and false hasImages
    // This ensures that even if no images exist, the template can check hasImages
    Object.keys(fieldMappings).forEach((section) => {
      Object.keys(fieldMappings[section]).forEach((fieldId) => {
        const fieldKey = fieldMappings[section][fieldId];
        const templateKey = `d.images.${section}.${fieldKey}`;
        const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
        
        // Initialize with empty array if not already set (flattened key)
        if (!templateData[templateKey]) {
          templateData[templateKey] = [];
        }
        // Initialize hasImages to false if not already set (flattened key)
        if (templateData[hasImagesKey] === undefined) {
          templateData[hasImagesKey] = false;
        }
        
        // Also initialize nested structure
        if (!templateData.d.images[section]) {
          templateData.d.images[section] = {};
        }
        if (!templateData.d.hasImages[section]) {
          templateData.d.hasImages[section] = {};
        }
        if (!templateData.d.images[section][fieldKey]) {
          templateData.d.images[section][fieldKey] = [];
        }
        if (templateData.d.hasImages[section][fieldKey] === undefined) {
          templateData.d.hasImages[section][fieldKey] = false;
        }
      });
    });
    
    // Now add actual images
    Object.keys(imagesBySectionField).forEach((key) => {
      const [section, fieldId] = key.split('.');
      const images = imagesBySectionField[key];
      
      console.log(`[documents] Processing ${key}: ${images.length} images`);
      
      if (fieldMappings[section] && fieldMappings[section][fieldId]) {
        const fieldKey = fieldMappings[section][fieldId];
        const templateKey = `d.images.${section}.${fieldKey}`;
        const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
        
        // Ensure images is an array and wrap each image for {{image}} usage inside loops
        const imageArray = Array.isArray(images) ? images : [];
        
        const imageCount = imageArray.length;
        
        // Бодит зурагуудыг wrap хийх (хуучин хэв маяг руу буцаах)
        const loopItems = imageArray.map((image, index) => ({
          image,
          index,
          total: imageCount,
          isFirst: index === 0,
          isLast: index === imageCount - 1,
        }));
        
        templateData[templateKey] = loopItems;
        templateData[hasImagesKey] = loopItems.length > 0;
        
        // Also add to nested structure for easy-template-x
        if (!templateData.d.images[section]) {
          templateData.d.images[section] = {};
        }
        if (!templateData.d.hasImages[section]) {
          templateData.d.hasImages[section] = {};
        }
        templateData.d.images[section][fieldKey] = loopItems;
        templateData.d.hasImages[section][fieldKey] = loopItems.length > 0;
        
        console.log(`[documents] Added ${templateKey}: ${imageCount} real images`);
        console.log(`[documents] Also added nested: d.images.${section}.${fieldKey} = ${loopItems.length} items`);
        
        // Log first image structure if exists
        if (loopItems.length > 0 && loopItems[0]?.image) {
          const firstImage = loopItems[0].image;
          const imageStructure = {
            has_type: !!firstImage._type,
            type: firstImage._type,
            has_source: !!firstImage.source,
            source_is_buffer: Buffer.isBuffer(firstImage.source),
            source_type: typeof firstImage.source,
            source_length: firstImage.source?.length,
            format: firstImage.format,
            formatType: typeof firstImage.format,
            formatValue: firstImage.format,
            formatIsMimeTypeEnum: firstImage.format === MimeType.Png || firstImage.format === MimeType.Jpeg || firstImage.format === MimeType.Gif || firstImage.format === MimeType.Bmp || firstImage.format === MimeType.Svg,
            formatName: firstImage.format === MimeType.Png ? 'Png' : firstImage.format === MimeType.Jpeg ? 'Jpeg' : firstImage.format === MimeType.Gif ? 'Gif' : firstImage.format === MimeType.Bmp ? 'Bmp' : firstImage.format === MimeType.Svg ? 'Svg' : 'Other',
            width: firstImage.width,
            height: firstImage.height,
          };
          
          console.log(`[documents] First image structure:`, imageStructure);
          
          // Check if format is correct
          // Note: MimeType enum values are strings, not numbers
          if (!imageStructure.formatIsMimeTypeEnum) {
            console.error(`[documents] ❌ IMAGE FORMAT ERROR for ${templateKey}:`, {
              format: firstImage.format,
              formatType: typeof firstImage.format,
              formatValue: firstImage.format,
              expected: 'MimeType enum (string)',
              actual: typeof firstImage.format,
              isMimeTypeJpeg: firstImage.format === MimeType.Jpeg,
              isMimeTypePng: firstImage.format === MimeType.Png,
              MimeTypeJpegValue: MimeType.Jpeg,
              MimeTypePngValue: MimeType.Png,
            });
          }
        }
      } else {
        console.warn(`[documents] No field mapping found for ${section}.${fieldId}`);
      }
    });

    // Add general images array if needed
    templateData['d.images'] = reportData.d?.images || [];

    console.log('[documents] Final template data keys count:', Object.keys(templateData).length);
    
    // Log image-related keys
    const imageKeys = Object.keys(templateData).filter(k => k.includes('images') || k.includes('hasImages'));
    console.log('[documents] Image-related template keys:', imageKeys.slice(0, 20));
    
    // Log sample hasImages values
    const hasImagesSample = imageKeys.filter(k => k.startsWith('d.hasImages')).slice(0, 10);
    console.log('[documents] Sample hasImages values:', 
      Object.fromEntries(hasImagesSample.map(k => [k, templateData[k]]))
    );
    
    // Log sample images arrays (flattened keys)
    const imagesSample = imageKeys.filter(k => k.startsWith('d.images.') && Array.isArray(templateData[k])).slice(0, 5);
    console.log('[documents] Sample images arrays (flattened):', 
      Object.fromEntries(imagesSample.map(k => {
        const loopItems = templateData[k];
        const realCount = loopItems.filter(item => !item?.isEmpty).length;
        const emptyCount = loopItems.filter(item => item?.isEmpty).length;
        const firstLoopItem = loopItems[0];
        const firstImage = firstLoopItem?.image || firstLoopItem;
        return [k, {
          totalCount: loopItems.length,
          realCount,
          emptyCount,
          firstImageType: firstImage?._type,
          firstImageHasSource: !!firstImage?.source,
          firstImageSourceIsBuffer: Buffer.isBuffer(firstImage?.source),
          firstImageSourceType: typeof firstImage?.source,
          firstItemIsEmpty: firstLoopItem?.isEmpty || false,
        }];
      }))
    );
    
    // Log nested structure for images
    if (templateData.d && templateData.d.images) {
      const nestedSections = Object.keys(templateData.d.images).slice(0, 3);
      console.log('[documents] Sample nested images structure:');
      nestedSections.forEach(section => {
        if (templateData.d.images[section]) {
          const fields = Object.keys(templateData.d.images[section]).slice(0, 2);
          fields.forEach(field => {
            const loopItems = templateData.d.images[section][field];
            const realCount = Array.isArray(loopItems) ? loopItems.filter(item => !item?.isEmpty).length : 0;
            const emptyCount = Array.isArray(loopItems) ? loopItems.filter(item => item?.isEmpty).length : 0;
            console.log(`  d.images.${section}.${field}: ${Array.isArray(loopItems) ? loopItems.length : 'not array'} items (${realCount} real + ${emptyCount} empty)`);
            if (Array.isArray(loopItems) && loopItems.length > 0) {
              const firstItem = loopItems[0];
              const firstImage = firstItem?.image || firstItem;
              console.log(`    First item: _type=${firstImage?._type}, hasSource=${!!firstImage?.source}, isBuffer=${Buffer.isBuffer(firstImage?.source)}, isEmpty=${firstItem?.isEmpty || false}`);
            }
          });
        }
      });
    }
    
    console.log('[documents] Sample template data values:', {
      'd.contractor.company': templateData['d.contractor.company'],
      'd.metadata.date': templateData['d.metadata.date'],
      'd.exterior.sensor_base.status': templateData['d.exterior.sensor_base.status'],
      'd.indicator.seal_bolt.status': templateData['d.indicator.seal_bolt.status'],
      'd.signatures.inspector': templateData['d.signatures.inspector'] ? 'exists' : 'missing',
    });
    console.log('[documents] About to process template with easy-template-x...');

    // Log template delimiter check (warning only, don't block processing)
    try {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(templateFile);
      const xml = await zip.file('word/document.xml').async('string');
      
      // Extract all text from <w:t> nodes and combine them to get actual placeholder count
      // This accounts for placeholders that may be split across multiple <w:t> nodes
      const textNodes = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
      const combinedText = textNodes.map(match => match[1]).join('');
      
      // Count delimiters in combined text (this matches Word's Find count)
      const openCount = (combinedText.match(/\{\{/g) || []).length;
      const closeCount = (combinedText.match(/\}\}/g) || []).length;
      
      // Also count in raw XML for comparison
      const rawOpenCount = (xml.match(/\{\{/g) || []).length;
      const rawCloseCount = (xml.match(/\}\}/g) || []).length;
      
      console.log(`[documents] Template delimiter check:`);
      console.log(`[documents]   Combined text (matches Word Find): ${openCount} {{ vs ${closeCount} }}`);
      if (rawOpenCount !== openCount || rawCloseCount !== closeCount) {
        console.log(`[documents]   Raw XML (split placeholders): ${rawOpenCount} {{ vs ${rawCloseCount} }}`);
      }
      
      if (openCount !== closeCount) {
        console.warn(`[documents] ⚠️ WARNING: Unmatched delimiters in template!`);
        console.warn(`[documents] Found ${openCount} opening {{ but ${closeCount} closing }}`);
        console.warn(`[documents] Continuing anyway - let easy-template-x handle the error...`);
      } else {
        console.log(`[documents] ✅ Delimiters are balanced (${openCount} pairs)`);
      }
    } catch (validationError) {
      console.warn('[documents] Could not validate template delimiters:', validationError.message);
      // Continue anyway - let easy-template-x handle the error
    }

    // Try to process template with easy-template-x
    let buffer;
    try {
      buffer = await templateHandler.process(templateFile, templateData);
      
      // Post-processing: Зурагуудыг grid layout-д байрлуулах
      // Одоогоор энэ нь ажиллахгүй байна, учир нь easy-template-x нь зурагуудыг зөвхөн эхний нүд дотор байрлуулж байна
      // buffer = await rearrangeImagesInGridLayout(buffer);
      
    } catch (processError) {
      // If error occurs, try to find which placeholder is causing the issue
      console.error('[documents] ❌ Template processing error:', processError.message);
      console.error('[documents] Error name:', processError.name);
      console.error('[documents] Error stack:', processError.stack);
      console.error('[documents] Full error object:', JSON.stringify(processError, Object.getOwnPropertyNames(processError), 2));
      
      // Try to extract more details about the error
      if (processError.openDelimiterText) {
        console.error('[documents] Open delimiter found:', processError.openDelimiterText);
      }
      
      // Try to find the problematic placeholder in XML
      try {
        const JSZip = require('jszip');
        const errorZip = await JSZip.loadAsync(templateFile);
        const errorXml = await errorZip.file('word/document.xml').async('string');
        
        // Find text nodes with unmatched delimiters
        const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        const problematicNodes = [];
        let textMatch;
        
        while ((textMatch = textNodePattern.exec(errorXml)) !== null) {
          const text = textMatch[1];
          const openCount = (text.match(/\{\{/g) || []).length;
          const closeCount = (text.match(/\}\}/g) || []).length;
          
          if (openCount !== closeCount) {
            problematicNodes.push({
              text: text.substring(0, 100),
              open: openCount,
              close: closeCount
            });
          }
        }
        
        if (problematicNodes.length > 0) {
          console.error('[documents] Found problematic text nodes:');
          problematicNodes.slice(0, 5).forEach((node, i) => {
            console.error(`  ${i + 1}. "${node.text}" ({{${node.open}} vs }}}${node.close})`);
          });
        }
      } catch (debugError) {
        console.error('[documents] Could not debug template:', debugError.message);
      }
      
      throw processError;
    }
    const filename = `inspection-${reportData.inspection.id}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating inspection DOCX:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      openDelimiterText: error.openDelimiterText,
    });
    return res.status(500).json({
      error: 'Failed to generate document',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name,
        openDelimiterText: error.openDelimiterText,
      } : undefined,
    });
  }
});

// Export functions for testing (before router export)
const exportedFunctions = {
  groupImagesBySectionAndField,
  createImageContent,
  createSignatureImageContent,
};

// Export router as default
module.exports = Object.assign(router, exportedFunctions);



