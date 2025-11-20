const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkTemplateImages() {
  try {
    console.log('Checking template for image placeholders...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Check for image Alt Text placeholders (various formats)
    const imageAltTexts1 = xml.match(/descr=["']image["']/gi) || [];
    const imageAltTexts2 = xml.match(/name=["']image["']/gi) || [];
    const imageAltTexts3 = xml.match(/cNvPr[^>]*name=["']image["']/gi) || [];
    const imageAltTexts = [...imageAltTexts1, ...imageAltTexts2, ...imageAltTexts3];
    console.log(`\nImage Alt Text placeholders (descr="image"): ${imageAltTexts1.length}`);
    console.log(`Image Alt Text placeholders (name="image"): ${imageAltTexts2.length}`);
    console.log(`Image Alt Text placeholders (cNvPr name="image"): ${imageAltTexts3.length}`);
    console.log(`Total image placeholders: ${imageAltTexts.length}`);
    
    // Also check for text "image" in document (might be placeholder text)
    const imageTextCount = (xml.match(/\bimage\b/gi) || []).length;
    console.log(`Text "image" occurrences: ${imageTextCount}`);
    
    // Check for condition placeholders
    const conditionPlaceholders = xml.match(/\{\{#d\.hasImages[^\}]+\}\}/g) || [];
    console.log(`Condition placeholders ({{#d.hasImages...}}): ${conditionPlaceholders.length}`);
    
    // Check for loop placeholders
    const loopPlaceholders = xml.match(/\{\{#d\.images[^\}]+\}\}/g) || [];
    console.log(`Loop placeholders ({{#d.images...}}): ${loopPlaceholders.length}`);
    
    // Check for closing placeholders
    const closingPlaceholders = xml.match(/\{\{\/d\.(images|hasImages)[^\}]+\}\}/g) || [];
    console.log(`Closing placeholders ({{/d...}}): ${closingPlaceholders.length}`);
    
    // Show samples
    if (conditionPlaceholders.length > 0) {
      console.log('\nSample condition placeholders:');
      conditionPlaceholders.slice(0, 5).forEach(p => {
        console.log(`  - ${p}`);
      });
    }
    
    if (loopPlaceholders.length > 0) {
      console.log('\nSample loop placeholders:');
      loopPlaceholders.slice(0, 5).forEach(p => {
        console.log(`  - ${p}`);
      });
    }
    
    if (imageAltTexts.length > 0) {
      console.log('\n✅ Found image Alt Text placeholders');
    } else {
      console.log('\n⚠️ WARNING: No image Alt Text placeholders found!');
      console.log('   Template needs placeholder images with Alt Text = "image"');
    }
    
    // Check if images are inside loops
    const hasImagesInLoops = loopPlaceholders.length > 0 && imageAltTexts.length > 0;
    if (hasImagesInLoops) {
      console.log('\n✅ Image placeholders found inside loops');
    } else if (loopPlaceholders.length > 0 && imageAltTexts.length === 0) {
      console.log('\n⚠️ WARNING: Loop placeholders exist but no image Alt Text placeholders found!');
      console.log('   Need to add placeholder images with Alt Text = "image" inside the loops');
    }
    
    console.log('\n✅ Template image check completed!');
  } catch (error) {
    console.error('Error checking template:', error.message);
  }
}

if (require.main === module) {
  checkTemplateImages();
}

module.exports = { checkTemplateImages };

