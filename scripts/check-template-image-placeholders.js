const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkTemplateImagePlaceholders() {
  try {
    console.log('Checking template for image placeholders in loops...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all loop placeholders
    const loopMatches = [...xml.matchAll(/\{\{#d\.images\.([^\}]+)\}\}/g)];
    console.log(`Found ${loopMatches.length} loop placeholders:\n`);
    
    const loopInfo = {};
    
    loopMatches.forEach((match, index) => {
      const fullMatch = match[0];
      const path = match[1];
      console.log(`${index + 1}. ${fullMatch} (path: ${path})`);
      
      if (!loopInfo[path]) {
        loopInfo[path] = {
          openPlaceholder: fullMatch,
          closePlaceholder: null,
          imagePlaceholders: [],
        };
      }
    });
    
    // Find closing placeholders
    const closeMatches = [...xml.matchAll(/\{\{\/d\.images\.([^\}]+)\}\}/g)];
    console.log(`\nFound ${closeMatches.length} closing placeholders:\n`);
    
    closeMatches.forEach((match, index) => {
      const fullMatch = match[0];
      const path = match[1];
      console.log(`${index + 1}. ${fullMatch} (path: ${path})`);
      
      if (loopInfo[path]) {
        loopInfo[path].closePlaceholder = fullMatch;
      }
    });
    
    // For each loop, check if there are image placeholders (Alt Text = "image") between open and close
    console.log('\n' + '='.repeat(80));
    console.log('Checking image placeholders inside loops:\n');
    
    for (const [path, info] of Object.entries(loopInfo)) {
      if (!info.openPlaceholder || !info.closePlaceholder) {
        console.log(`⚠️  ${path}: Missing open or close placeholder`);
        continue;
      }
      
      // Find the position of open and close placeholders
      const openIndex = xml.indexOf(info.openPlaceholder);
      const closeIndex = xml.indexOf(info.closePlaceholder);
      
      if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) {
        console.log(`⚠️  ${path}: Invalid placeholder positions`);
        continue;
      }
      
      // Extract the content between open and close
      const loopContent = xml.substring(openIndex, closeIndex + info.closePlaceholder.length);
      
      // Count image placeholders (Alt Text = "image") in this loop
      const imageMatches = loopContent.match(/descr=["']image["']/gi) || [];
      const imageCount = imageMatches.length;
      
      console.log(`${path}:`);
      console.log(`  Open: ${info.openPlaceholder}`);
      console.log(`  Close: ${info.closePlaceholder}`);
      console.log(`  Image placeholders (Alt Text="image"): ${imageCount}`);
      
      if (imageCount === 0) {
        console.log(`  ❌ WARNING: No image placeholder found in this loop!`);
        console.log(`     Easy Template X needs at least one image with Alt Text="image" inside the loop.`);
      } else if (imageCount === 1) {
        console.log(`  ✅ Found ${imageCount} image placeholder - this will be repeated for each image in the array`);
      } else {
        console.log(`  ⚠️  Found ${imageCount} image placeholders - only the first one will be used per iteration`);
      }
      console.log('');
    }
    
    // Summary
    console.log('='.repeat(80));
    console.log('Summary:');
    const loopsWithImages = Object.values(loopInfo).filter(info => {
      if (!info.openPlaceholder || !info.closePlaceholder) return false;
      const openIndex = xml.indexOf(info.openPlaceholder);
      const closeIndex = xml.indexOf(info.closePlaceholder);
      if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) return false;
      const loopContent = xml.substring(openIndex, closeIndex + info.closePlaceholder.length);
      const imageCount = (loopContent.match(/descr=["']image["']/gi) || []).length;
      return imageCount > 0;
    });
    
    console.log(`  Total loops: ${Object.keys(loopInfo).length}`);
    console.log(`  Loops with image placeholders: ${loopsWithImages.length}`);
    console.log(`  Loops without image placeholders: ${Object.keys(loopInfo).length - loopsWithImages.length}`);
    
    if (loopsWithImages.length < Object.keys(loopInfo).length) {
      console.log('\n❌ Some loops are missing image placeholders!');
      console.log('   Add placeholder images with Alt Text="image" inside each loop.');
    } else {
      console.log('\n✅ All loops have image placeholders!');
    }
    
  } catch (error) {
    console.error('Error checking template:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkTemplateImagePlaceholders();
}

module.exports = { checkTemplateImagePlaceholders };







