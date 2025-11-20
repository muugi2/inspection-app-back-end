const { PrismaClient } = require('@prisma/client');
const { buildInspectionReportData } = require('../services/report-service');
const { TemplateHandler, MimeType } = require('easy-template-x');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Copy functions from routes/documents.js
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

const prisma = new PrismaClient();

async function debugEasyTemplateXImageReplacement() {
  try {
    console.log('='.repeat(80));
    console.log('Debugging easy-template-x Image Replacement in Loops');
    console.log('='.repeat(80));
    console.log('');
    
    const answerId = 469;
    
    // Get inspection ID
    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: BigInt(answerId) },
      select: { inspectionId: true },
    });
    
    if (!answer) {
      console.log(`❌ Answer ID ${answerId} not found`);
      return;
    }
    
    const inspectionId = answer.inspectionId.toString();
    
    // Build report data
    const reportData = await buildInspectionReportData(prisma, {
      answerId: answerId.toString(),
      inspectionId: inspectionId,
    });
    
    // Group images
    const imagesBySectionField = await groupImagesBySectionAndField(
      reportData.d?.images || []
    );
    
    // Create template data
    const fieldMappings = {
      indicator: {
        led_display: 'led_display',
      },
      jbox: {
        box_integrity: 'box_integrity',
      },
    };
    
    const templateData = {
      ...reportData,
    };
    
    if (!templateData.d) {
      templateData.d = {};
    }
    if (!templateData.d.images) {
      templateData.d.images = {};
    }
    if (!templateData.d.hasImages) {
      templateData.d.hasImages = {};
    }
    
    // Add images for specific test loops
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
    
    // Debug: Check specific loop data
    console.log('Checking template data for test loops:');
    console.log('');
    
    const testLoops = [
      { section: 'indicator', field: 'led_display' },
      { section: 'jbox', field: 'box_integrity' },
    ];
    
    testLoops.forEach(({ section, field }) => {
      const flattenedKey = `d.images.${section}.${field}`;
      const nestedPath = `d.images.${section}.${field}`;
      
      const flattened = templateData[flattenedKey];
      const nested = templateData.d?.images?.[section]?.[field];
      
      console.log(`${section}.${field}:`);
      console.log(`  Flattened key "${flattenedKey}":`, {
        exists: flattened !== undefined,
        isArray: Array.isArray(flattened),
        length: Array.isArray(flattened) ? flattened.length : 'N/A',
      });
      
      console.log(`  Nested path "${nestedPath}":`, {
        exists: nested !== undefined,
        isArray: Array.isArray(nested),
        length: Array.isArray(nested) ? nested.length : 'N/A',
      });
      
      if (Array.isArray(flattened) && flattened.length > 0) {
        const firstImage = flattened[0];
        console.log(`  First image structure:`);
        console.log(`    _type: ${firstImage._type}`);
        console.log(`    has source: ${!!firstImage.source}`);
        console.log(`    source is Buffer: ${Buffer.isBuffer(firstImage.source)}`);
        console.log(`    source type: ${typeof firstImage.source}`);
        console.log(`    source length: ${firstImage.source?.length || 'N/A'}`);
        console.log(`    format: ${firstImage.format}`);
        console.log(`    format type: ${typeof firstImage.format}`);
        console.log(`    format is MimeType.Jpeg: ${firstImage.format === MimeType.Jpeg}`);
        console.log(`    format is MimeType.Png: ${firstImage.format === MimeType.Png}`);
        console.log(`    width: ${firstImage.width}`);
        console.log(`    height: ${firstImage.height}`);
        
        // Check if format is correct enum
        const isMimeTypeEnum = 
          firstImage.format === MimeType.Png ||
          firstImage.format === MimeType.Jpeg ||
          firstImage.format === MimeType.Gif ||
          firstImage.format === MimeType.Bmp ||
          firstImage.format === MimeType.Svg;
        
        console.log(`    format is MimeType enum: ${isMimeTypeEnum}`);
        
        if (!isMimeTypeEnum) {
          console.log(`    ❌ PROBLEM: Format is not a MimeType enum!`);
          console.log(`       Expected: MimeType.Jpeg, MimeType.Png, etc.`);
          console.log(`       Actual: ${firstImage.format} (${typeof firstImage.format})`);
        }
        
        // Check source buffer
        if (!Buffer.isBuffer(firstImage.source)) {
          console.log(`    ❌ PROBLEM: Source is not a Buffer!`);
          console.log(`       Expected: Buffer object`);
          console.log(`       Actual: ${typeof firstImage.source}`);
        }
      }
      
      console.log('');
    });
    
    // Load template
    const templatePath = path.join(__dirname, '..', 'templates', 'template.docx');
    const templateFile = fs.readFileSync(templatePath);
    
    // Create a minimal test template with just one loop
    console.log('Creating minimal test template...');
    
    // Extract the loop content from original template
    const zip = await JSZip.loadAsync(templateFile);
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find indicator.led_display loop
    const loopPattern = /\{\{#d\.images\.indicator\.led_display\}\}([\s\S]*?)\{\{\/d\.images\.indicator\.led_display\}\}/;
    const loopMatch = xml.match(loopPattern);
    
    if (loopMatch) {
      console.log(`✅ Found loop in template`);
      console.log(`   Loop content length: ${loopMatch[1].length} bytes`);
      
      // Check if image is in loop
      const hasImage = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi.test(loopMatch[1]);
      console.log(`   Has image with Alt Text="image": ${hasImage}`);
      
      if (hasImage) {
        const imageMatch = loopMatch[1].match(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/i);
        if (imageMatch) {
          const altText = imageMatch[1].match(/descr=["']([^"']+)["']/i)?.[1];
          console.log(`   Image Alt Text: "${altText || 'none'}"`);
        }
      }
    } else {
      console.log(`❌ Loop not found in template`);
    }
    
    console.log('');
    
    // Test with minimal template data
    console.log('Testing with minimal template data...');
    
    const minimalTemplateData = {
      d: {
        images: {
          indicator: {
            led_display: templateData.d.images.indicator?.led_display || [],
          },
        },
        hasImages: {
          indicator: {
            led_display: (templateData.d.images.indicator?.led_display?.length || 0) > 0,
          },
        },
      },
    };
    
    console.log('Minimal template data:');
    console.log(JSON.stringify({
      'd.images.indicator.led_display.length': minimalTemplateData.d.images.indicator.led_display.length,
      'd.hasImages.indicator.led_display': minimalTemplateData.d.hasImages.indicator.led_display,
      'firstImage._type': minimalTemplateData.d.images.indicator.led_display[0]?._type,
      'firstImage.hasSource': !!minimalTemplateData.d.images.indicator.led_display[0]?.source,
      'firstImage.sourceIsBuffer': Buffer.isBuffer(minimalTemplateData.d.images.indicator.led_display[0]?.source),
      'firstImage.format': minimalTemplateData.d.images.indicator.led_display[0]?.format,
    }, null, 2));
    
    console.log('');
    
    // Process template
    const templateHandler = new TemplateHandler({
      delimiters: {
        tagStart: '{{',
        tagEnd: '}}',
        containerTagOpen: '#',
        containerTagClose: '/',
      },
      fixRawXml: true,
      maxXmlDepth: 25,
    });
    
    try {
      console.log('Processing template with minimal data...');
      const buffer = await templateHandler.process(templateFile, minimalTemplateData);
      
      console.log('✅ Processing succeeded');
      
      // Check output
      const zipAfter = await JSZip.loadAsync(buffer);
      const xmlAfter = await zipAfter.file('word/document.xml').async('string');
      
      // Check if loop was processed
      const loopAfter = xmlAfter.match(loopPattern);
      console.log(`Loop placeholder in output: ${loopAfter ? '❌ Still exists' : '✅ Removed'}`);
      
      // Check if images were added
      const imagesAfter = [...xmlAfter.matchAll(/<w:drawing[^>]*>/gi)];
      console.log(`Total images in output: ${imagesAfter.length}`);
      
      // Check if loop area has images
      if (!loopAfter) {
        // Find where loop was (approximate)
        const loopText = '{{#d.images.indicator.led_display}}';
        const loopIndex = xml.indexOf(loopText);
        if (loopIndex !== -1) {
          const areaAfter = xmlAfter.substring(Math.max(0, loopIndex - 1000), loopIndex + 5000);
          const imagesInArea = [...areaAfter.matchAll(/<w:drawing[^>]*>/gi)];
          console.log(`Images in loop area: ${imagesInArea.length}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Processing failed: ${error.message}`);
      console.log(`   Error name: ${error.name}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.substring(0, 500)}...`);
      }
    }
    
    // Also test with flattened keys
    console.log('\n' + '='.repeat(80));
    console.log('Testing with flattened keys...');
    console.log('='.repeat(80));
    
    const flattenedTemplateData = {
      ...minimalTemplateData,
      'd.images.indicator.led_display': templateData['d.images.indicator.led_display'] || [],
      'd.hasImages.indicator.led_display': templateData['d.hasImages.indicator.led_display'] || false,
    };
    
    console.log('Flattened template data:');
    console.log(JSON.stringify({
      'd.images.indicator.led_display.length (nested)': flattenedTemplateData.d.images.indicator.led_display.length,
      'd.images.indicator.led_display.length (flattened)': flattenedTemplateData['d.images.indicator.led_display']?.length || 0,
      'd.hasImages.indicator.led_display (nested)': flattenedTemplateData.d.hasImages.indicator.led_display,
      'd.hasImages.indicator.led_display (flattened)': flattenedTemplateData['d.hasImages.indicator.led_display'],
    }, null, 2));
    
    try {
      console.log('\nProcessing template with flattened keys...');
      const buffer2 = await templateHandler.process(templateFile, flattenedTemplateData);
      
      console.log('✅ Processing succeeded');
      
      const zipAfter2 = await JSZip.loadAsync(buffer2);
      const xmlAfter2 = await zipAfter2.file('word/document.xml').async('string');
      
      const loopAfter2 = xmlAfter2.match(loopPattern);
      console.log(`Loop placeholder in output: ${loopAfter2 ? '❌ Still exists' : '✅ Removed'}`);
      
      const imagesAfter2 = [...xmlAfter2.matchAll(/<w:drawing[^>]*>/gi)];
      console.log(`Total images in output: ${imagesAfter2.length}`);
      
    } catch (error) {
      console.log(`❌ Processing failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  debugEasyTemplateXImageReplacement();
}

module.exports = { debugEasyTemplateXImageReplacement };

