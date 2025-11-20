const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { TemplateHandler, MimeType } = require('easy-template-x');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function checkEasyTemplateXImageReplacement() {
  try {
    console.log('='.repeat(80));
    console.log('Testing easy-template-x image replacement in loops');
    console.log('='.repeat(80));
    console.log('');
    
    const templateFile = fs.readFileSync(TEMPLATE_PATH);
    
    // Create test image (1x1 PNG)
    const testImage = {
      _type: 'image',
      source: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
      format: MimeType.Png,
      width: 300,
      height: 200,
    };
    
    // Test with nested structure
    const templateData1 = {
      d: {
        images: {
          indicator: {
            led_display: [testImage],
          },
        },
        hasImages: {
          indicator: {
            led_display: true,
          },
        },
      },
    };
    
    // Test with flattened keys
    const templateData2 = {
      'd.images.indicator.led_display': [testImage],
      'd.hasImages.indicator.led_display': true,
    };
    
    // Test with both
    const templateData3 = {
      d: {
        images: {
          indicator: {
            led_display: [testImage],
          },
        },
        hasImages: {
          indicator: {
            led_display: true,
          },
        },
      },
      'd.images.indicator.led_display': [testImage],
      'd.hasImages.indicator.led_display': true,
    };
    
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
    
    console.log('Testing with nested structure only...');
    try {
      const buffer1 = await templateHandler.process(templateFile, templateData1);
      console.log('✅ Nested structure: Success');
      fs.writeFileSync(path.join(__dirname, '..', 'templates', 'test-nested.docx'), buffer1);
    } catch (error) {
      console.log('❌ Nested structure: Failed');
      console.log('   Error:', error.message);
    }
    
    console.log('\nTesting with flattened keys only...');
    try {
      const buffer2 = await templateHandler.process(templateFile, templateData2);
      console.log('✅ Flattened keys: Success');
      fs.writeFileSync(path.join(__dirname, '..', 'templates', 'test-flattened.docx'), buffer2);
    } catch (error) {
      console.log('❌ Flattened keys: Failed');
      console.log('   Error:', error.message);
    }
    
    console.log('\nTesting with both nested and flattened...');
    try {
      const buffer3 = await templateHandler.process(templateFile, templateData3);
      console.log('✅ Both: Success');
      fs.writeFileSync(path.join(__dirname, '..', 'templates', 'test-both.docx'), buffer3);
      
      // Check if image was replaced
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(buffer3);
      const xml = await zip.file('word/document.xml').async('string');
      
      // Count images in the output
      const imageCount = (xml.match(/<w:drawing/g) || []).length;
      console.log(`   Images in output: ${imageCount}`);
      
      // Check if test image (1x1 PNG) is in the output
      const hasTestImage = xml.includes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      console.log(`   Test image found in output: ${hasTestImage}`);
      
    } catch (error) {
      console.log('❌ Both: Failed');
      console.log('   Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Check the test output files to see if images were replaced');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkEasyTemplateXImageReplacement();
}

module.exports = { checkEasyTemplateXImageReplacement };

