const { PrismaClient } = require('@prisma/client');
const { buildInspectionReportData } = require('../services/report-service');
const { loadImagePayload, inferMimeType, normalizeRelativePath } = require('../utils/imageStorage');
const { TemplateHandler, MimeType } = require('easy-template-x');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const prisma = new PrismaClient();

// Copy createImageContent from routes/documents.js
const MIME_TYPE_MAP = {
  'image/png': MimeType.Png,
  'image/jpeg': MimeType.Jpeg,
  'image/jpg': MimeType.Jpeg,
  'image/gif': MimeType.Gif,
  'image/bmp': MimeType.Bmp,
  'image/svg+xml': MimeType.Svg,
};

async function createImageContent(imageData) {
  if (!imageData || typeof imageData !== 'object' || !imageData.base64 || !imageData.mimeType) {
    return null;
  }

  let normalizedType = imageData.mimeType.toLowerCase();
  let format = MIME_TYPE_MAP[normalizedType];

  if (!format) {
    return null;
  }

  try {
    let source = Buffer.from(imageData.base64, 'base64');
    
    if (!source || source.length === 0) {
      return null;
    }

    return {
      _type: 'image',
      source,
      format,
      width: 300,
      height: 200,
    };
  } catch (error) {
    console.error('Failed to build image:', error.message);
    return null;
  }
}

async function groupImagesBySectionAndField(images) {
  const grouped = {};

  if (!Array.isArray(images)) {
    return grouped;
  }

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    const section = image.section;
    const fieldId = image.fieldId;
    
    if (section && fieldId) {
      const key = `${section}.${fieldId}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      const imageContent = await createImageContent(image);
      if (imageContent) {
        grouped[key].push(imageContent);
      }
    }
  }

  return grouped;
}

async function analyzeLastInspection() {
  try {
    console.log('='.repeat(80));
    console.log('Сүүлийн Асуудалтай Шинжилгээний Шинжилгээ');
    console.log('Analysis of Last Failed Inspection');
    console.log('='.repeat(80));
    console.log('');

    // Answer ID 469 - сүүлийн асуудалтай шинжилгээ
    const answerId = 469;
    console.log(`Шинжилгээний Answer ID: ${answerId}`);
    console.log(`Inspection Answer ID: ${answerId}`);
    console.log('');

    // Step 1: Database-аас мэдээлэл авах
    console.log('Step 1: Database-аас мэдээлэл авах / Getting data from database...');
    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: BigInt(answerId) },
      include: {
        inspection: {
          include: {
            contract: { include: { organization: true } },
            site: { include: { organization: true } },
            device: { include: { model: true } },
          },
        },
      },
    });

    if (!answer) {
      console.log(`❌ Answer ID ${answerId} олдсонгүй / not found`);
      return;
    }

    const inspectionId = answer.inspectionId.toString();
    console.log(`✅ Inspection ID: ${inspectionId}`);
    console.log(`   Title: ${answer.inspection.title}`);
    console.log(`   Status: ${answer.inspection.status}`);
    console.log(`   Answered At: ${answer.answeredAt}`);
    console.log('');

    // Step 2: Database-аас зурагны мэдээлэл авах
    console.log('Step 2: Database-аас зурагны мэдээлэл / Getting image data from database...');
    const imageRows = await prisma.$queryRaw`
      SELECT
        id,
        field_id,
        section,
        image_order,
        image_url,
        uploaded_at
      FROM inspection_question_images
      WHERE answer_id = ${BigInt(answerId)}
      ORDER BY section, field_id, image_order;
    `;

    console.log(`✅ Database-аас ${imageRows.length} зурагны мэдээлэл олдлоо`);
    console.log(`   Found ${imageRows.length} image records in database`);
    console.log('');

    // Зурагны тархалт
    const imagesBySection = {};
    imageRows.forEach(row => {
      const section = row.section || 'unknown';
      if (!imagesBySection[section]) {
        imagesBySection[section] = 0;
      }
      imagesBySection[section]++;
    });

    console.log('Зурагны тархалт / Image distribution by section:');
    Object.entries(imagesBySection).forEach(([section, count]) => {
      console.log(`   ${section}: ${count} зураг`);
    });
    console.log('');

    // Step 3: FTP Server-ээс зураг унших
    console.log('Step 3: FTP Server-ээс зураг унших / Loading images from FTP server...');
    let ftpSuccessCount = 0;
    let ftpFailCount = 0;
    const ftpResults = [];

    for (const row of imageRows.slice(0, 10)) { // Эхний 10 зураг шалгах
      const normalizedPath = normalizeRelativePath(row.image_url);
      if (!normalizedPath) {
        ftpFailCount++;
        ftpResults.push({
          id: row.id?.toString(),
          url: row.image_url,
          status: 'FAILED',
          reason: 'Failed to normalize path',
        });
        continue;
      }

      const payload = await loadImagePayload(normalizedPath);
      if (payload.base64) {
        ftpSuccessCount++;
        ftpResults.push({
          id: row.id?.toString(),
          path: normalizedPath,
          status: 'SUCCESS',
          base64Length: payload.base64.length,
          size: payload.size,
        });
      } else {
        ftpFailCount++;
        ftpResults.push({
          id: row.id?.toString(),
          path: normalizedPath,
          status: 'FAILED',
          reason: payload.error || 'Unknown error',
        });
      }
    }

    console.log(`✅ FTP Server шалгалт / FTP Server check:`);
    console.log(`   Амжилттай / Success: ${ftpSuccessCount}/${imageRows.slice(0, 10).length}`);
    console.log(`   Амжилтгүй / Failed: ${ftpFailCount}/${imageRows.slice(0, 10).length}`);
    if (ftpFailCount > 0) {
      console.log(`   ⚠️  Асуудалтай зурагууд / Failed images:`);
      ftpResults.filter(r => r.status === 'FAILED').forEach(r => {
        console.log(`      - ID ${r.id}: ${r.reason}`);
      });
    }
    console.log('');

    // Step 4: loadImagesForAnswer шалгах
    console.log('Step 4: loadImagesForAnswer шалгах / Checking loadImagesForAnswer...');
    const reportData = await buildInspectionReportData(prisma, {
      answerId: answerId.toString(),
      inspectionId: inspectionId,
    });

    const images = reportData.d?.images || [];
    console.log(`✅ loadImagesForAnswer: ${images.length} зураг амжилттай уншигдсан`);
    console.log(`   Successfully loaded ${images.length} images`);

    // Зурагны мэдээлэл
    const imagesWithBase64 = images.filter(img => img.base64).length;
    const imagesWithoutBase64 = images.length - imagesWithBase64;
    console.log(`   Base64-тай / With base64: ${imagesWithBase64}`);
    console.log(`   Base64-гүй / Without base64: ${imagesWithoutBase64}`);

    if (imagesWithoutBase64 > 0) {
      console.log(`   ⚠️  ${imagesWithoutBase64} зураг base64-гүй байна`);
    }
    console.log('');

    // Step 5: groupImagesBySectionAndField шалгах
    console.log('Step 5: groupImagesBySectionAndField шалгах / Checking groupImagesBySectionAndField...');
    const imagesBySectionField = await groupImagesBySectionAndField(images);

    console.log(`✅ Зурагууд ${Object.keys(imagesBySectionField).length} бүлэгт хуваагдсан`);
    console.log(`   Images grouped into ${Object.keys(imagesBySectionField).length} groups`);

    // Бүлэг бүрийн мэдээлэл
    Object.entries(imagesBySectionField).forEach(([key, imageArray]) => {
      console.log(`   ${key}: ${imageArray.length} зураг`);
    });
    console.log('');

    // Step 6: createImageContent шалгах
    console.log('Step 6: createImageContent шалгах / Checking createImageContent...');
    let validImageCount = 0;
    let invalidImageCount = 0;
    const imageStructureIssues = [];

    Object.entries(imagesBySectionField).forEach(([key, imageArray]) => {
      imageArray.forEach((image, index) => {
        const issues = [];

        if (!image._type || image._type !== 'image') {
          issues.push('Missing or invalid _type');
        }

        if (!image.source) {
          issues.push('Missing source');
        } else if (!Buffer.isBuffer(image.source)) {
          issues.push('Source is not a Buffer');
        }

        if (!image.format) {
          issues.push('Missing format');
        } else {
          const isMimeTypeEnum = 
            image.format === MimeType.Png ||
            image.format === MimeType.Jpeg ||
            image.format === MimeType.Gif ||
            image.format === MimeType.Bmp ||
            image.format === MimeType.Svg;
          
          if (!isMimeTypeEnum) {
            issues.push(`Format is not MimeType enum: ${image.format} (${typeof image.format})`);
          }
        }

        if (!image.width || !image.height) {
          issues.push('Missing width or height');
        }

        if (issues.length === 0) {
          validImageCount++;
        } else {
          invalidImageCount++;
          imageStructureIssues.push({
            key,
            index,
            issues,
          });
        }
      });
    });

    console.log(`✅ Image structure check:`);
    console.log(`   Зөв / Valid: ${validImageCount}`);
    console.log(`   Буруу / Invalid: ${invalidImageCount}`);

    if (invalidImageCount > 0) {
      console.log(`   ⚠️  Асуудалтай зурагууд / Images with issues:`);
      imageStructureIssues.slice(0, 5).forEach(({ key, index, issues }) => {
        console.log(`      ${key}[${index}]: ${issues.join(', ')}`);
      });
    }
    console.log('');

    // Step 7: Template data бүтэц шалгах
    console.log('Step 7: Template data бүтэц шалгах / Checking template data structure...');
    
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

    // Flatten template fields
    function flattenTemplateFields(value, prefix = '', result = {}) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return result;
      }

      Object.entries(value).forEach(([key, entry]) => {
        const nextKey = prefix ? `${prefix}.${key}` : key;

        if (entry === null || typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
          result[nextKey] = entry ?? '';
          return;
        }

        if (typeof entry === 'object' && !Array.isArray(entry)) {
          flattenTemplateFields(entry, nextKey, result);
        }
        
        if (Array.isArray(entry)) {
          result[nextKey] = entry;
        }
      });

      return result;
    }

    const flattenedFields = flattenTemplateFields(reportData.d || {}, 'd');
    const templateData = {
      ...reportData,
      ...flattenedFields,
    };

    // Initialize images structure
    if (!templateData.d) {
      templateData.d = {};
    }
    if (!templateData.d.images) {
      templateData.d.images = {};
    }
    if (!templateData.d.hasImages) {
      templateData.d.hasImages = {};
    }

    // Add images to template data
    Object.keys(imagesBySectionField).forEach((key) => {
      const [section, fieldId] = key.split('.');
      const images = imagesBySectionField[key];
      
      if (fieldMappings[section] && fieldMappings[section][fieldId]) {
        const fieldKey = fieldMappings[section][fieldId];
        const templateKey = `d.images.${section}.${fieldKey}`;
        const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
        
        const imageArray = Array.isArray(images) ? images : [];
        templateData[templateKey] = imageArray;
        templateData[hasImagesKey] = imageArray.length > 0;
        
        if (!templateData.d.images[section]) {
          templateData.d.images[section] = {};
        }
        if (!templateData.d.hasImages[section]) {
          templateData.d.hasImages[section] = {};
        }
        templateData.d.images[section][fieldKey] = imageArray;
        templateData.d.hasImages[section][fieldKey] = imageArray.length > 0;
      }
    });

    // Check template data structure
    let flattenedKeysCount = 0;
    let nestedKeysCount = 0;
    let missingKeys = [];

    Object.keys(fieldMappings).forEach((section) => {
      Object.keys(fieldMappings[section]).forEach((fieldId) => {
        const fieldKey = fieldMappings[section][fieldId];
        const flattenedKey = `d.images.${section}.${fieldKey}`;
        const nestedPath = `d.images.${section}.${fieldKey}`;

        if (templateData[flattenedKey] !== undefined) {
          flattenedKeysCount++;
        } else {
          missingKeys.push(`Flattened: ${flattenedKey}`);
        }

        if (templateData.d?.images?.[section]?.[fieldKey] !== undefined) {
          nestedKeysCount++;
        } else {
          missingKeys.push(`Nested: ${nestedPath}`);
        }
      });
    });

    console.log(`✅ Template data structure:`);
    console.log(`   Flattened keys: ${flattenedKeysCount}/${Object.keys(fieldMappings).reduce((sum, s) => sum + Object.keys(fieldMappings[s]).length, 0)}`);
    console.log(`   Nested keys: ${nestedKeysCount}/${Object.keys(fieldMappings).reduce((sum, s) => sum + Object.keys(fieldMappings[s]).length, 0)}`);

    if (missingKeys.length > 0) {
      console.log(`   ⚠️  Дутуу keys / Missing keys: ${missingKeys.length}`);
      missingKeys.slice(0, 5).forEach(key => console.log(`      - ${key}`));
    }
    console.log('');

    // Step 8: Template файл шалгах
    console.log('Step 8: Template файл шалгах / Checking template file...');
    const templatePath = path.join(__dirname, '..', 'templates', 'template.docx');
    
    if (!fs.existsSync(templatePath)) {
      console.log(`❌ Template файл олдсонгүй / Template file not found: ${templatePath}`);
      return;
    }

    const templateFile = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateFile);
    const xml = await zip.file('word/document.xml').async('string');

    // Count loops
    const loopPattern = /\{\{#d\.images\.([^}]+)\}\}/g;
    const loops = [...xml.matchAll(loopPattern)];
    console.log(`✅ Template-д ${loops.length} loop олдлоо`);
    console.log(`   Found ${loops.length} loops in template`);

    // Check each loop for images
    let loopsWithImages = 0;
    let loopsWithoutImages = 0;
    const loopDetails = [];

    for (const loopMatch of loops) {
      const loopKey = loopMatch[1];
      const loopStart = `{{#d.images.${loopKey}}}`;
      const loopEnd = `{{/d.images.${loopKey}}}`;
      
      const loopStartIndex = xml.indexOf(loopStart);
      const loopEndIndex = xml.indexOf(loopEnd);
      
      if (loopStartIndex !== -1 && loopEndIndex !== -1) {
        const loopContent = xml.substring(loopStartIndex, loopEndIndex + loopEnd.length);
        const hasImage = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi.test(loopContent);
        
        if (hasImage) {
          loopsWithImages++;
        } else {
          loopsWithoutImages++;
        }

        loopDetails.push({
          key: loopKey,
          hasImage,
          contentLength: loopContent.length,
        });
      }
    }

    console.log(`   Loop-ууд зурагтай / Loops with images: ${loopsWithImages}`);
    console.log(`   Loop-ууд зураггүй / Loops without images: ${loopsWithoutImages}`);

    if (loopsWithoutImages > 0) {
      console.log(`   ⚠️  ${loopsWithoutImages} loop-д зураг placeholder байхгүй байна`);
    }
    console.log('');

    // Дүгнэлт
    console.log('='.repeat(80));
    console.log('Дүгнэлт / Summary');
    console.log('='.repeat(80));
    console.log('');

    const issues = [];

    if (ftpFailCount > 0) {
      issues.push(`FTP Server: ${ftpFailCount} зураг уншигдаагүй`);
    }

    if (imagesWithoutBase64 > 0) {
      issues.push(`loadImagesForAnswer: ${imagesWithoutBase64} зураг base64-гүй`);
    }

    if (invalidImageCount > 0) {
      issues.push(`createImageContent: ${invalidImageCount} зураг буруу бүтэцтэй`);
    }

    if (missingKeys.length > 0) {
      issues.push(`Template data: ${missingKeys.length} key дутуу`);
    }

    if (loopsWithoutImages > 0) {
      issues.push(`Template: ${loopsWithoutImages} loop-д зураг placeholder байхгүй`);
    }

    if (issues.length === 0) {
      console.log('✅ Бүх алхамууд амжилттай / All steps successful');
      console.log('   Гэхдээ easy-template-x нь зурагуудыг орлуулахгүй байна');
      console.log('   However, easy-template-x is not replacing images');
      console.log('');
      console.log('   Магадгүй шалтгаан / Possible reasons:');
      console.log('   1. easy-template-x-ийн loop-ийн дотор зураг placeholder олох логик');
      console.log('   2. Image object-ийн формат easy-template-x-ийн хүлээлттэй таарахгүй');
      console.log('   3. Template data-ийн бүтэц easy-template-x-ийн хүлээлттэй таарахгүй');
    } else {
      console.log('⚠️  Олдсон асуудлууд / Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    console.log('');

  } catch (error) {
    console.error('❌ Алдаа / Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  analyzeLastInspection();
}

module.exports = { analyzeLastInspection };






