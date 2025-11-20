const { PrismaClient } = require('@prisma/client');
const { buildInspectionReportData } = require('../services/report-service');
const { TemplateHandler, MimeType } = require('easy-template-x');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Copy functions from routes/documents.js for testing
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

async function testEasyTemplateXProcessing() {
  try {
    console.log('='.repeat(80));
    console.log('Testing easy-template-x Processing (Step 9)');
    console.log('='.repeat(80));
    console.log('');
    
    const answerId = 469;
    console.log(`Building report data for answer ID: ${answerId}\n`);
    
    // Get inspection ID from answer
    const answer = await prisma.InspectionAnswer.findUnique({
      where: { id: BigInt(answerId) },
      select: { inspectionId: true },
    });
    
    if (!answer) {
      console.log(`❌ Answer ID ${answerId} not found`);
      return;
    }
    
    const inspectionId = answer.inspectionId.toString();
    console.log(`Found inspection ID: ${inspectionId}\n`);
    
    // Step 1: Build report data
    console.log('Step 1: Building report data...');
    const reportData = await buildInspectionReportData(prisma, {
      answerId: answerId.toString(),
      inspectionId: inspectionId,
    });
    
    if (!reportData || !reportData.d) {
      console.log('❌ Failed to build report data');
      return;
    }
    
    console.log(`✅ Report data built: ${reportData.d?.images?.length || 0} images\n`);
    
    // Step 2: Group images
    console.log('Step 2: Grouping images...');
    const imagesBySectionField = await groupImagesBySectionAndField(
      reportData.d?.images || []
    );
    
    console.log(`✅ Images grouped: ${Object.keys(imagesBySectionField).length} groups\n`);
    
    // Step 3: Create template data (same as in routes/documents.js)
    console.log('Step 3: Creating template data...');
    
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
    
    const templateData = {
      ...reportData,
    };
    
    // Ensure nested structure exists
    if (!templateData.d) {
      templateData.d = {};
    }
    if (!templateData.d.images) {
      templateData.d.images = {};
    }
    if (!templateData.d.hasImages) {
      templateData.d.hasImages = {};
    }
    
    // Initialize all field mappings
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
    
    // Add actual images
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
    
    console.log(`✅ Template data created\n`);
    
    // Step 4: Load template file
    console.log('Step 4: Loading template file...');
    const templatePath = path.join(__dirname, '..', 'templates', 'template.docx');
    
    if (!fs.existsSync(templatePath)) {
      console.log(`❌ Template file not found: ${templatePath}`);
      return;
    }
    
    const templateFile = fs.readFileSync(templatePath);
    console.log(`✅ Template file loaded: ${templateFile.length} bytes\n`);
    
    // Step 5: Analyze template before processing
    console.log('Step 5: Analyzing template before processing...');
    const zipBefore = await JSZip.loadAsync(templateFile);
    const xmlBefore = await zipBefore.file('word/document.xml').async('string');
    
    // Count loop placeholders
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
    const loopsBefore = [...xmlBefore.matchAll(loopPattern)];
    console.log(`  Loop placeholders found: ${loopsBefore.length}`);
    
    // Count image placeholders with Alt Text="image"
    const imageAltTextPattern = /descr=["']image["']/gi;
    const imagesBefore = [...xmlBefore.matchAll(imageAltTextPattern)];
    console.log(`  Image placeholders (Alt Text="image") found: ${imagesBefore.length}`);
    
    // Count total images
    const drawingPattern = /<w:drawing[^>]*>/gi;
    const drawingsBefore = [...xmlBefore.matchAll(drawingPattern)];
    console.log(`  Total <w:drawing> elements: ${drawingsBefore.length}\n`);
    
    // Step 6: Process template with easy-template-x
    console.log('Step 6: Processing template with easy-template-x...');
    
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
    
    let buffer;
    let processingError = null;
    
    try {
      const startTime = Date.now();
      buffer = await templateHandler.process(templateFile, templateData);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Template processed successfully in ${duration}ms`);
      console.log(`  Output size: ${buffer.length} bytes\n`);
    } catch (error) {
      processingError = error;
      console.log(`❌ Template processing failed:`);
      console.log(`  Error: ${error.message}`);
      console.log(`  Name: ${error.name}`);
      if (error.stack) {
        console.log(`  Stack: ${error.stack.substring(0, 500)}...`);
      }
      console.log('');
      
      // Try to continue with error analysis
      buffer = null;
    }
    
    // Step 7: Analyze output if processing succeeded
    if (buffer) {
      console.log('Step 7: Analyzing output...');
      
      const zipAfter = await JSZip.loadAsync(buffer);
      const xmlAfter = await zipAfter.file('word/document.xml').async('string');
      
      // Count loop placeholders (should be 0 if processed correctly)
      const loopsAfter = [...xmlAfter.matchAll(loopPattern)];
      console.log(`  Loop placeholders remaining: ${loopsAfter.length}`);
      
      // Count image placeholders with Alt Text="image" (should be 0 if replaced)
      const imagesAfter = [...xmlAfter.matchAll(imageAltTextPattern)];
      console.log(`  Image placeholders (Alt Text="image") remaining: ${imagesAfter.length}`);
      
      // Count total images
      const drawingsAfter = [...xmlAfter.matchAll(drawingPattern)];
      console.log(`  Total <w:drawing> elements: ${drawingsAfter.length}`);
      
      // Calculate changes
      const loopsRemoved = loopsBefore.length - loopsAfter.length;
      const imagesReplaced = imagesBefore.length - imagesAfter.length;
      const drawingsAdded = drawingsAfter.length - drawingsBefore.length;
      
      console.log(`\n  Changes:`);
      console.log(`    Loops removed: ${loopsRemoved}`);
      console.log(`    Images replaced: ${imagesReplaced}`);
      console.log(`    Drawings added: ${drawingsAdded}\n`);
      
      // Check specific loops
      console.log('Step 8: Checking specific loops...');
      const testLoops = [
        'indicator.led_display',
        'jbox.box_integrity',
        'cleanliness.top_platform',
        'exterior.sensor_base',
      ];
      
      testLoops.forEach(loopPath => {
        const [section, field] = loopPath.split('.');
        const hasImages = templateData.d?.hasImages?.[section]?.[field] || false;
        const imageCount = templateData.d?.images?.[section]?.[field]?.length || 0;
        
        // Check if loop placeholder exists in output
        const loopPlaceholder = `{{#d.images.${loopPath}}}`;
        const loopExists = xmlAfter.includes(loopPlaceholder);
        
        // Check if images were added (count <w:drawing> in the loop area)
        // This is approximate - we look for images near the loop text
        const loopText = `{{#d.images.${loopPath}}}`;
        const loopIndex = xmlAfter.indexOf(loopText);
        let imagesInLoop = 0;
        
        if (loopIndex !== -1) {
          // Look for images within 5000 chars after loop start
          const loopArea = xmlAfter.substring(loopIndex, loopIndex + 5000);
          const drawingsInArea = [...loopArea.matchAll(drawingPattern)];
          imagesInLoop = drawingsInArea.length;
        }
        
        console.log(`  ${loopPath}:`);
        console.log(`    Has images in data: ${hasImages} (${imageCount} images)`);
        console.log(`    Loop placeholder in output: ${loopExists ? '❌ Still exists' : '✅ Removed'}`);
        console.log(`    Images in loop area: ${imagesInLoop}`);
        
        if (hasImages && imageCount > 0) {
          if (loopExists) {
            console.log(`    ⚠️  WARNING: Loop not processed`);
          } else if (imagesInLoop === 0) {
            console.log(`    ⚠️  WARNING: Loop processed but no images found`);
          } else {
            console.log(`    ✅ Loop processed, images found`);
          }
        }
        console.log('');
      });
      
      // Save output for manual inspection
      const outputPath = path.join(__dirname, '..', 'templates', 'test-output-easy-template-x.docx');
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Output saved to: ${outputPath}`);
      console.log(`   Open this file to manually check if images were replaced\n`);
    } else {
      console.log('Step 7: Skipped (processing failed)\n');
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log('='.repeat(80));
    
    if (processingError) {
      console.log(`❌ Processing failed: ${processingError.message}`);
      console.log(`   This indicates an issue with easy-template-x processing`);
    } else if (buffer) {
      const zipAfter = await JSZip.loadAsync(buffer);
      const xmlAfter = await zipAfter.file('word/document.xml').async('string');
      
      const loopsAfter = [...xmlAfter.matchAll(loopPattern)];
      const imagesAfter = [...xmlAfter.matchAll(imageAltTextPattern)];
      
      const loopsRemoved = loopsBefore.length - loopsAfter.length;
      const imagesReplaced = imagesBefore.length - imagesAfter.length;
      
      console.log(`✅ Processing succeeded`);
      console.log(`   Loops processed: ${loopsRemoved}/${loopsBefore.length}`);
      console.log(`   Images replaced: ${imagesReplaced}/${imagesBefore.length}`);
      
      if (loopsRemoved === loopsBefore.length && imagesReplaced === imagesBefore.length) {
        console.log(`   ✅ All loops and images processed correctly`);
      } else {
        console.log(`   ⚠️  Some loops or images were not processed`);
        if (imagesReplaced === 0) {
          console.log(`   ❌ CRITICAL: No images were replaced!`);
          console.log(`      This means easy-template-x is not finding/replacing image placeholders`);
          console.log(`      Possible causes:`);
          console.log(`      1. Image Alt Text is not exactly "image"`);
          console.log(`      2. Image placeholder is not inside the loop`);
          console.log(`      3. Image structure in template is incorrect`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testEasyTemplateXProcessing();
}

module.exports = { testEasyTemplateXProcessing };

