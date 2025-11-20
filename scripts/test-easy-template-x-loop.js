const { TemplateHandler, MimeType } = require('easy-template-x');
const fs = require('fs');
const path = require('path');

// Test easy-template-x loop image replacement
async function testEasyTemplateXLoop() {
  try {
    console.log('='.repeat(80));
    console.log('Testing easy-template-x loop image replacement');
    console.log('='.repeat(80));
    console.log('');
    
    // Create a simple test template
    const testTemplatePath = path.join(__dirname, '..', 'templates', 'template.docx');
    
    if (!fs.existsSync(testTemplatePath)) {
      console.error('Template file not found:', testTemplatePath);
      return;
    }
    
    const templateFile = fs.readFileSync(testTemplatePath);
    
    // Create test data similar to actual data
    const testImage = {
      _type: 'image',
      source: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'), // 1x1 PNG
      format: MimeType.Png,
      width: 300,
      height: 200,
    };
    
    const templateData = {
      d: {
        images: {
          indicator: {
            led_display: [testImage], // Array with one image
          },
        },
        hasImages: {
          indicator: {
            led_display: true,
          },
        },
      },
      // Also add flattened keys
      'd.images.indicator.led_display': [testImage],
      'd.hasImages.indicator.led_display': true,
    };
    
    console.log('Test data structure:');
    console.log('  d.images.indicator.led_display:', Array.isArray(templateData.d.images.indicator.led_display));
    console.log('  d.images.indicator.led_display.length:', templateData.d.images.indicator.led_display.length);
    console.log('  First image _type:', templateData.d.images.indicator.led_display[0]._type);
    console.log('  First image format:', templateData.d.images.indicator.led_display[0].format);
    console.log('  First image source is Buffer:', Buffer.isBuffer(templateData.d.images.indicator.led_display[0].source));
    console.log('');
    
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
    
    console.log('Processing template...');
    const buffer = await templateHandler.process(templateFile, templateData);
    
    console.log('✅ Template processed successfully');
    console.log('  Output size:', buffer.length, 'bytes');
    
    // Save test output
    const outputPath = path.join(__dirname, '..', 'templates', 'test-output.docx');
    fs.writeFileSync(outputPath, buffer);
    console.log('  Test output saved to:', outputPath);
    console.log('');
    console.log('💡 Check the output file to see if images were replaced');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

if (require.main === module) {
  testEasyTemplateXLoop();
}

module.exports = { testEasyTemplateXLoop };

