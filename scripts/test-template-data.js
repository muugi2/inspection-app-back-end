const { PrismaClient } = require('@prisma/client');
const { buildInspectionReportData } = require('../services/report-service');
const { TemplateHandler, MimeType } = require('easy-template-x');

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

async function testTemplateData() {
  try {
    console.log('='.repeat(80));
    console.log('Testing Template Data Structure');
    console.log('='.repeat(80));
    console.log('');
    
    const answerId = 469; // Using the same answer ID from previous tests
    console.log(`Building report data for answer ID: ${answerId}\n`);
    
    // First, get inspection ID from answer
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
    
    // Step 1: Build report data (includes loadImagesForAnswer)
    console.log('Step 1: Building report data...');
    const reportData = await buildInspectionReportData(prisma, {
      answerId: answerId.toString(),
      inspectionId: inspectionId,
    });
    
    if (!reportData || !reportData.d) {
      console.log('❌ Failed to build report data');
      return;
    }
    
    console.log(`✅ Report data built successfully`);
    console.log(`   Images count: ${reportData.d?.images?.length || 0}`);
    console.log('');
    
    // Step 2: Group images by section and field
    console.log('Step 2: Grouping images by section and field...');
    const imagesBySectionField = await groupImagesBySectionAndField(
      reportData.d?.images || []
    );
    
    console.log(`✅ Images grouped: ${Object.keys(imagesBySectionField).length} groups`);
    console.log(`   Groups: ${Object.keys(imagesBySectionField).join(', ')}`);
    console.log('');
    
    // Step 3: Create template data structure (same as in routes/documents.js)
    console.log('Step 3: Creating template data structure...');
    
    // Field mappings (same as in routes/documents.js)
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
    
    // Initialize template data with nested structure
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
    
    // Initialize all field mappings with empty arrays and false hasImages
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
    
    // Add actual images
    Object.keys(imagesBySectionField).forEach((key) => {
      const [section, fieldId] = key.split('.');
      const images = imagesBySectionField[key];
      
      if (fieldMappings[section] && fieldMappings[section][fieldId]) {
        const fieldKey = fieldMappings[section][fieldId];
        const templateKey = `d.images.${section}.${fieldKey}`;
        const hasImagesKey = `d.hasImages.${section}.${fieldKey}`;
        
        // Ensure images is an array
        const imageArray = Array.isArray(images) ? images : [];
        templateData[templateKey] = imageArray;
        templateData[hasImagesKey] = imageArray.length > 0;
        
        // Also add to nested structure
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
    
    console.log(`✅ Template data structure created`);
    console.log('');
    
    // Step 4: Validate template data structure
    console.log('Step 4: Validating template data structure...');
    console.log('');
    
    // Check flattened keys
    const flattenedImageKeys = Object.keys(templateData).filter(k => 
      k.startsWith('d.images.') && Array.isArray(templateData[k])
    );
    const flattenedHasImageKeys = Object.keys(templateData).filter(k => 
      k.startsWith('d.hasImages.')
    );
    
    console.log(`Flattened keys:`);
    console.log(`  Image arrays: ${flattenedImageKeys.length}`);
    console.log(`  HasImages values: ${flattenedHasImageKeys.length}`);
    console.log('');
    
    // Check nested structure
    const nestedSections = Object.keys(templateData.d.images || {});
    const nestedHasImageSections = Object.keys(templateData.d.hasImages || {});
    
    console.log(`Nested structure:`);
    console.log(`  Sections with images: ${nestedSections.length}`);
    console.log(`  Sections with hasImages: ${nestedHasImageSections.length}`);
    console.log('');
    
    // Validate specific examples
    console.log('Validating specific examples:');
    console.log('');
    
    const testCases = [
      { section: 'exterior', field: 'beam' },
      { section: 'exterior', field: 'beam_joint_plate' },
      { section: 'indicator', field: 'led_display' },
      { section: 'jbox', field: 'box_integrity' },
      { section: 'cleanliness', field: 'top_platform' },
    ];
    
    testCases.forEach(({ section, field }) => {
      const flattenedKey = `d.images.${section}.${field}`;
      const hasImagesKey = `d.hasImages.${section}.${field}`;
      
      const hasFlattened = templateData[flattenedKey] !== undefined;
      const hasNested = templateData.d?.images?.[section]?.[field] !== undefined;
      const hasFlattenedHasImages = templateData[hasImagesKey] !== undefined;
      const hasNestedHasImages = templateData.d?.hasImages?.[section]?.[field] !== undefined;
      
      const flattenedArray = templateData[flattenedKey];
      const nestedArray = templateData.d?.images?.[section]?.[field];
      const flattenedHasImages = templateData[hasImagesKey];
      const nestedHasImages = templateData.d?.hasImages?.[section]?.[field];
      
      const flattenedIsArray = Array.isArray(flattenedArray);
      const nestedIsArray = Array.isArray(nestedArray);
      const flattenedCount = flattenedIsArray ? flattenedArray.length : 0;
      const nestedCount = nestedIsArray ? nestedArray.length : 0;
      
      const flattenedMatches = flattenedIsArray && nestedIsArray && 
        flattenedCount === nestedCount && 
        flattenedHasImages === nestedHasImages;
      
      console.log(`${section}.${field}:`);
      console.log(`  Flattened key exists: ${hasFlattened}`);
      console.log(`  Nested key exists: ${hasNested}`);
      console.log(`  Flattened is array: ${flattenedIsArray}`);
      console.log(`  Nested is array: ${nestedIsArray}`);
      console.log(`  Flattened count: ${flattenedCount}`);
      console.log(`  Nested count: ${nestedCount}`);
      console.log(`  Flattened hasImages: ${hasFlattenedHasImages} = ${flattenedHasImages}`);
      console.log(`  Nested hasImages: ${hasNestedHasImages} = ${nestedHasImages}`);
      console.log(`  ✅ Matches: ${flattenedMatches}`);
      
      // Check first image structure if exists
      if (flattenedIsArray && flattenedArray.length > 0) {
        const firstImage = flattenedArray[0];
        console.log(`  First image structure:`);
        console.log(`    _type: ${firstImage._type}`);
        console.log(`    has source: ${!!firstImage.source}`);
        console.log(`    source is Buffer: ${Buffer.isBuffer(firstImage.source)}`);
        console.log(`    format: ${firstImage.format}`);
        console.log(`    width: ${firstImage.width}`);
        console.log(`    height: ${firstImage.height}`);
      }
      
      console.log('');
    });
    
    // Summary
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log('='.repeat(80));
    
    const totalFlattened = flattenedImageKeys.length;
    const totalNested = nestedSections.reduce((sum, section) => {
      return sum + Object.keys(templateData.d.images[section] || {}).length;
    }, 0);
    
    const totalWithImages = flattenedImageKeys.filter(k => 
      Array.isArray(templateData[k]) && templateData[k].length > 0
    ).length;
    
    console.log(`Total flattened image arrays: ${totalFlattened}`);
    console.log(`Total nested image arrays: ${totalNested}`);
    console.log(`Arrays with images: ${totalWithImages}`);
    console.log('');
    
    // Check if structure is correct for easy-template-x
    console.log('Structure validation for easy-template-x:');
    console.log('');
    
    const requiredKeys = [
      'd.images.exterior.beam',
      'd.hasImages.exterior.beam',
    ];
    
    let allKeysExist = true;
    requiredKeys.forEach(key => {
      const exists = templateData[key] !== undefined;
      console.log(`  ${key}: ${exists ? '✅' : '❌'}`);
      if (!exists) allKeysExist = false;
    });
    
    console.log('');
    console.log(`All required keys exist: ${allKeysExist ? '✅' : '❌'}`);
    
    // Check nested structure
    const requiredNested = [
      'd.images.exterior.beam',
      'd.hasImages.exterior.beam',
    ];
    
    let allNestedExist = true;
    requiredNested.forEach(path => {
      const parts = path.split('.');
      let value = templateData;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      const exists = value !== undefined;
      console.log(`  ${path} (nested): ${exists ? '✅' : '❌'}`);
      if (!exists) allNestedExist = false;
    });
    
    console.log('');
    console.log(`All required nested paths exist: ${allNestedExist ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testTemplateData();
}

module.exports = { testTemplateData };

