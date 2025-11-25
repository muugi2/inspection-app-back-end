const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkImageAltText() {
  try {
    console.log('Checking template for image Alt Text...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Check for image Alt Text with "image" (correct)
    const imageAltTexts1 = xml.match(/descr=["']image["']/gi) || [];
    const imageAltTexts2 = xml.match(/name=["']image["']/gi) || [];
    const imageAltTexts3 = xml.match(/cNvPr[^>]*name=["']image["']/gi) || [];
    const correctAltTexts = [...imageAltTexts1, ...imageAltTexts2, ...imageAltTexts3];
    
    // Check for image Alt Text with "{{image}}" (WRONG - should not have placeholders)
    const wrongAltTexts1 = xml.match(/descr=["']\{\{image\}\}["']/gi) || [];
    const wrongAltTexts2 = xml.match(/name=["']\{\{image\}\}["']/gi) || [];
    const wrongAltTexts = [...wrongAltTexts1, ...wrongAltTexts2];
    
    // Check for any Alt Text with placeholders
    const placeholderAltTexts = xml.match(/(descr|name)=["']\{\{[^}]+\}\}["']/gi) || [];
    
    console.log('✅ Correct Alt Text (descr="image" or name="image"):');
    console.log(`   descr="image": ${imageAltTexts1.length}`);
    console.log(`   name="image": ${imageAltTexts2.length}`);
    console.log(`   cNvPr name="image": ${imageAltTexts3.length}`);
    console.log(`   Total correct: ${correctAltTexts.length}\n`);
    
    if (wrongAltTexts.length > 0) {
      console.log('❌ WRONG Alt Text found (with {{image}}):');
      console.log(`   Found ${wrongAltTexts.length} images with {{image}} in Alt Text`);
      console.log('   These should be changed to just "image" (without {{}})\n');
    }
    
    if (placeholderAltTexts.length > 0) {
      console.log('⚠️  Alt Text with placeholders found:');
      placeholderAltTexts.slice(0, 10).forEach((match, i) => {
        const extracted = match.match(/(descr|name)=["'](\{\{[^}]+\}\})["']/i);
        if (extracted) {
          console.log(`   ${i+1}. ${extracted[1]}="${extracted[2]}"`);
        }
      });
      console.log(`   Total: ${placeholderAltTexts.length}\n`);
    }
    
    // Check for loop placeholders
    const loopPlaceholders = xml.match(/\{\{#d\.images[^\}]+\}\}/g) || [];
    console.log(`Loop placeholders ({{#d.images...}}): ${loopPlaceholders.length}`);
    
    if (loopPlaceholders.length > 0) {
      console.log('\nSample loop placeholders:');
      loopPlaceholders.slice(0, 5).forEach(p => {
        console.log(`  - ${p}`);
      });
    }
    
    // Summary
    console.log('\n📋 Summary:');
    if (correctAltTexts.length > 0 && wrongAltTexts.length === 0) {
      console.log('✅ All image Alt Text is correct (using "image" without {{}})');
    } else if (wrongAltTexts.length > 0) {
      console.log('❌ Some images have WRONG Alt Text (using {{image}} instead of image)');
      console.log('   Fix: Change Alt Text from "{{image}}" to "image"');
    } else if (correctAltTexts.length === 0 && loopPlaceholders.length > 0) {
      console.log('⚠️  Loop placeholders exist but no image Alt Text placeholders found!');
      console.log('   Need to add placeholder images with Alt Text = "image" inside the loops');
    }
    
    console.log('\n✅ Template Alt Text check completed!');
  } catch (error) {
    console.error('Error checking template:', error.message);
  }
}

if (require.main === module) {
  checkImageAltText();
}

module.exports = { checkImageAltText };







