const express = require('express');
const path = require('path');
const fs = require('fs');
const { TemplateHandler, MimeType } = require('easy-template-x');
const sharp = require('sharp');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const JSZip = require('jszip');
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

/**
 * Generate DOCX buffer for an inspection answer
 * @param {BigInt} answerId - The inspection answer ID
 * @returns {Promise<Buffer>} The generated DOCX file buffer
 */
async function generateInspectionDocx(answerId) {
  const answerIdBigInt = typeof answerId === 'bigint' ? answerId : BigInt(answerId);
  const reportData = await buildInspectionReportData(prisma, { answerId: answerIdBigInt });

  const templatePath = path.join(
    __dirname,
    '..',
    'templates',
    REPORT_TEMPLATE_FILE
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file ${REPORT_TEMPLATE_FILE} is missing.`);
  }

  const templateFile = fs.readFileSync(templatePath);
  
  // Flatten the d object specifically with 'd' prefix
  const flattenedFields = flattenTemplateFields(reportData.d || {}, 'd');
  console.log('[documents] Flattened fields count:', Object.keys(flattenedFields).length);
  
  // Create templateData with both nested structure and flattened keys
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

  // Signature image
  const inspectorSignature = reportData.d?.signatures?.inspector;
  const inspectorImage = createSignatureImageContent(inspectorSignature);
  if (inspectorImage) {
    templateData['d.signatures.inspector'] = inspectorImage;
  }

  // FTP image
  const ftpImage = reportData.d?.ftp_image;
  const ftpImageContent = createSignatureImageContent(ftpImage);
  if (ftpImageContent) {
    ftpImageContent.width = 300;
    ftpImageContent.height = 200;
    templateData['d.ftp_image'] = ftpImageContent;
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

  // Initialize all field mappings with empty arrays and false hasImages
  Object.keys(fieldMappings).forEach((section) => {
    Object.keys(fieldMappings[section]).forEach((fieldId) => {
      const fieldKey = fieldMappings[section][fieldId];
      const templateKey = `d.images.${section}.${fieldKey}`;
      const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
      
      if (!templateData[templateKey]) {
        templateData[templateKey] = [];
      }
      if (templateData[hasImagesKey] === undefined) {
        templateData[hasImagesKey] = false;
      }
      
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
    
    if (fieldMappings[section] && fieldMappings[section][fieldId]) {
      const fieldKey = fieldMappings[section][fieldId];
      const templateKey = `d.images.${section}.${fieldKey}`;
      const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
      
      const imageArray = Array.isArray(images) ? images : [];
      const imageCount = imageArray.length;
      
      const loopItems = imageArray.map((image, index) => ({
        image,
        index,
        total: imageCount,
        isFirst: index === 0,
        isLast: index === imageCount - 1,
      }));
      
      templateData[templateKey] = loopItems;
      templateData[hasImagesKey] = loopItems.length > 0;
      
      if (!templateData.d.images[section]) {
        templateData.d.images[section] = {};
      }
      if (!templateData.d.hasImages[section]) {
        templateData.d.hasImages[section] = {};
      }
      templateData.d.images[section][fieldKey] = loopItems;
      templateData.d.hasImages[section][fieldKey] = loopItems.length > 0;
    }
  });

  // Add general images array if needed
  templateData['d.images'] = reportData.d?.images || [];

  // Process template with easy-template-x
  let buffer = await templateHandler.process(templateFile, templateData);
  
  // Post-processing: Remove empty paragraphs left by conditional blocks
  // NOTE: This function is conservative - it only removes paragraphs that are completely empty
  // to avoid accidentally removing paragraphs with images or other content
  try {
    buffer = await removeEmptyParagraphs(buffer);
  } catch (postProcessError) {
    console.error('[documents] ⚠️ Post-processing failed, returning buffer without cleanup:', postProcessError);
    // If post-processing fails, return original buffer to preserve images
    // This ensures images are never lost even if post-processing has issues
  }
  
  return buffer;
}

/**
 * Remove empty paragraphs from generated DOCX file
 * This fixes the issue where conditional blocks leave empty paragraphs when they are false
 * Improved version that properly detects and removes truly empty paragraphs
 * @param {Buffer} docxBuffer - The generated DOCX file buffer
 * @returns {Promise<Buffer>} The cleaned DOCX file buffer
 */
async function removeEmptyParagraphs(docxBuffer) {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    let docXml = await zip.file('word/document.xml').async('string');
    
    console.log('[documents] Post-processing: Removing empty paragraphs...');
    console.log('[documents] Original XML length:', docXml.length);
    
    // Improved approach: Use a more reliable method to find and remove empty paragraphs
    // Match paragraph tags with their full content, including nested elements
    const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    
    let cleanedXml = docXml;
    let removedCount = 0;
    let lastIndex = 0;
    const parts = [];
    let match;
    
    // Reset regex lastIndex
    paragraphPattern.lastIndex = 0;
    
    // Find all paragraphs
    while ((match = paragraphPattern.exec(docXml)) !== null) {
      // Add content before this paragraph
      if (match.index > lastIndex) {
        parts.push(docXml.substring(lastIndex, match.index));
      }
      
      const fullParagraph = match[0];
      const paragraphContent = match[1];
      
      // Check if paragraph is truly empty
      const isEmpty = isParagraphEmpty(paragraphContent);
      
      if (isEmpty) {
        // Remove this paragraph completely
        removedCount++;
        console.log(`[documents] Removing empty paragraph at position ${match.index}`);
      } else {
        // Keep this paragraph
        parts.push(fullParagraph);
      }
      
      lastIndex = match.index + fullParagraph.length;
    }
    
    // Add remaining content after last paragraph
    if (lastIndex < docXml.length) {
      parts.push(docXml.substring(lastIndex));
    }
    
    // Rebuild XML
    cleanedXml = parts.join('');
    
    // Additional cleanup: Remove excessive consecutive empty paragraph tags
    // This handles cases where multiple empty paragraphs were adjacent
    cleanedXml = cleanedXml.replace(/(<\/w:p>\s*(?:<w:p[^>]*>\s*<\/w:p>\s*)*){3,}/g, '</w:p>\n');
    
    // Also remove standalone empty paragraph tags that might remain
    cleanedXml = cleanedXml.replace(/<w:p(?:\s[^>]*)?>\s*<\/w:p>/g, '');
    
    // Remove multiple consecutive newlines/whitespace between paragraphs
    cleanedXml = cleanedXml.replace(/(<\/w:p>\s*){2,}/g, '</w:p>\n');
    
    if (removedCount > 0) {
      console.log(`[documents] ✅ Removed ${removedCount} empty paragraph(s)`);
      console.log(`[documents] XML length after cleanup: ${cleanedXml.length} (reduced by ${docXml.length - cleanedXml.length} bytes)`);
    } else {
      console.log('[documents] ℹ️  No empty paragraphs found to remove');
    }
    
    // IMPORTANT: Preserve all image files in the zip
    console.log('[documents] Preserving all files in zip (especially images in word/media/)...');
    
    // Update only the document.xml, keep all other files unchanged
    zip.file('word/document.xml', cleanedXml);
    
    // Generate new buffer with all original files preserved
    const cleanedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    
    return cleanedBuffer;
  } catch (error) {
    console.error('[documents] ❌ Error removing empty paragraphs:', error);
    console.error('[documents] Error details:', {
      message: error.message,
      stack: error.stack,
    });
    // If post-processing fails, return original buffer
    return docxBuffer;
  }
}

/**
 * Check if a paragraph is truly empty (contains no meaningful content)
 * @param {string} paragraphContent - The content inside <w:p>...</w:p>
 * @returns {boolean} True if paragraph is empty
 */
function isParagraphEmpty(paragraphContent) {
  // Remove all XML tags to check for text content
  const textOnly = paragraphContent
    .replace(/<[^>]+>/g, '') // Remove all XML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&#160;/g, ' ') // Replace &#160; with space
    .trim();
  
  // If there's any text, it's not empty
  if (textOnly.length > 0) {
    return false;
  }
  
  // Check for images (preserve paragraphs with images)
  const hasImages = paragraphContent.includes('<w:drawing') || 
                    paragraphContent.includes('<w:pict') ||
                    paragraphContent.includes('<a:blip') ||
                    paragraphContent.includes('<a:graphic') ||
                    paragraphContent.includes('<wp:docPr') ||
                    paragraphContent.includes('r:embed=') ||
                    paragraphContent.includes('r:link=') ||
                    paragraphContent.includes('wordml://');
  
  if (hasImages) {
    return false; // Keep paragraphs with images
  }
  
  // Check for tables
  if (paragraphContent.includes('<w:tbl')) {
    return false;
  }
  
  // Check for hyperlinks
  if (paragraphContent.includes('<w:hyperlink')) {
    return false;
  }
  
  // Check for bookmarks
  if (paragraphContent.includes('<w:bookmarkStart')) {
    return false;
  }
  
  // Check for other meaningful elements
  const hasOtherElements = /<w:(ins|del|moveFrom|moveTo|oMath|oMathPara|permStart|permEnd|proofErr|sdt|smartTag|subDoc)[^>]*>/.test(paragraphContent);
  
  if (hasOtherElements) {
    return false;
  }
  
  // Check if paragraph only contains paragraph properties (w:pPr) and nothing else
  const onlyProperties = /^(\s*<w:pPr[^>]*>[\s\S]*?<\/w:pPr>\s*)*$/.test(paragraphContent);
  
  if (onlyProperties) {
    return true; // Empty paragraph with only properties
  }
  
  // Check if paragraph only contains empty runs (<w:r></w:r> or <w:r><w:t></w:t></w:r>)
  const runsOnly = paragraphContent.match(/<w:r[^>]*>[\s\S]*?<\/w:r>/g);
  if (runsOnly) {
    let allRunsEmpty = true;
    for (const run of runsOnly) {
      // Extract text from run
      const runText = run.replace(/<[^>]+>/g, '').trim();
      if (runText.length > 0) {
        allRunsEmpty = false;
        break;
      }
    }
    if (allRunsEmpty) {
      return true; // All runs are empty
    }
  }
  
  // If we get here, paragraph might have some content we're not detecting
  // Be conservative and keep it
  return false;
}

// Generate DOCX using Docxtemplater (answer ID)
router.get('/answers/:answerId/docx', authMiddleware, async (req, res) => {
  try {
    const answerId = BigInt(req.params.answerId);
    const buffer = await generateInspectionDocx(answerId);
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
  generateInspectionDocx,
};

// Export router as default
module.exports = Object.assign(router, exportedFunctions);



