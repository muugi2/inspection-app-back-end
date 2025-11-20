const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function checkLoopImagePlaceholderStructure() {
  try {
    console.log('='.repeat(80));
    console.log('Checking Loop Image Placeholder Structure');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all loop placeholders
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
    const loops = [];
    let match;
    
    while ((match = loopPattern.exec(xml)) !== null) {
      const loopPath = match[1];
      const openIndex = match.index;
      const openFull = match[0];
      
      // Find closing placeholder
      const closePattern = new RegExp(`\\{\\{/d\\.images\\.${loopPath.replace(/\./g, '\\.')}\\}\\}`);
      const closeMatch = xml.substring(openIndex).match(closePattern);
      
      if (closeMatch) {
        const closeIndex = openIndex + closeMatch.index;
        const closeFull = closeMatch[0];
        const loopContent = xml.substring(openIndex, closeIndex + closeFull.length);
        
        // Find image placeholders inside this loop
        const imageMatches = [...loopContent.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
        
        loops.push({
          path: loopPath,
          openFull,
          closeFull,
          loopContent,
          imageCount: imageMatches.length,
          images: imageMatches.map(m => ({
            full: m[0],
            hasAltText: /descr=/gi.test(m[0]),
            altText: m[0].match(/descr=["']([^"']+)["']/gi)?.[0],
            altTextValue: m[0].match(/descr=["']([^"']+)["']/i)?.[1],
            isImageAltText: /descr=["']image["']/gi.test(m[0]),
            position: m.index,
          })),
        });
      }
    }
    
    console.log(`Found ${loops.length} loops\n`);
    
    loops.forEach((loop, i) => {
      console.log(`${'='.repeat(80)}`);
      console.log(`${i + 1}. Loop: ${loop.path}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`   Open: ${loop.openFull}`);
      console.log(`   Close: ${loop.closeFull}`);
      console.log(`   Images found: ${loop.imageCount}`);
      console.log('');
      
      if (loop.images.length === 0) {
        console.log('   ❌ PROBLEM: No image placeholder found inside loop!');
        console.log('   💡 SOLUTION: Add an image with Alt Text="image" inside the loop');
      } else {
        loop.images.forEach((img, j) => {
          console.log(`   Image ${j + 1}:`);
          console.log(`     Has Alt Text: ${img.hasAltText}`);
          console.log(`     Alt Text: ${img.altText || 'none'}`);
          console.log(`     Alt Text Value: ${img.altTextValue || 'none'}`);
          console.log(`     Is "image": ${img.isImageAltText ? '✅' : '❌'}`);
          
          if (!img.isImageAltText) {
            console.log(`     ⚠️  PROBLEM: Alt Text is not exactly "image"`);
            console.log(`        Current: "${img.altTextValue || 'none'}"`);
            console.log(`        Expected: "image"`);
            console.log(`     💡 SOLUTION: Change Alt Text to exactly "image" (without quotes)`);
          }
          
          // Check if image is in a paragraph
          const imageIndex = loop.loopContent.indexOf(img.full);
          const beforeImage = loop.loopContent.substring(Math.max(0, imageIndex - 500), imageIndex);
          const afterImage = loop.loopContent.substring(imageIndex + img.full.length, imageIndex + img.full.length + 500);
          const hasPBefore = /<w:p[^>]*>[\s\S]*$/gi.test(beforeImage);
          const hasPAfter = /^[\s\S]*<\/w:p>/gi.test(afterImage);
          const inParagraph = hasPBefore && hasPAfter;
          
          console.log(`     In paragraph: ${inParagraph ? '✅' : '❌'}`);
          
          // Check if image is after loop opening
          const loopContentStart = loop.loopContent.indexOf(loop.openFull) + loop.openFull.length;
          const imagePosition = loop.loopContent.indexOf(img.full);
          const isAfterLoop = imagePosition > loopContentStart;
          const distanceFromLoop = imagePosition - loopContentStart;
          
          console.log(`     After loop opening: ${isAfterLoop ? '✅' : '❌'} (${distanceFromLoop} chars)`);
          
          // Check image structure
          const hasBlip = /<a:blip[^>]*>/gi.test(img.full);
          const hasPic = /<pic:pic[^>]*>/gi.test(img.full);
          const hasInline = /<wp:inline[^>]*>/gi.test(img.full);
          
          console.log(`     Structure: <a:blip>=${hasBlip}, <pic:pic>=${hasPic}, <wp:inline>=${hasInline}`);
          
          if (!hasBlip || !hasPic || !hasInline) {
            console.log(`     ⚠️  WARNING: Image structure might be incomplete`);
          }
          
          console.log('');
        });
      }
      
      // Summary for this loop
      const correctImages = loop.images.filter(img => img.isImageAltText);
      if (correctImages.length === 0 && loop.images.length > 0) {
        console.log('   ❌ SUMMARY: No images with Alt Text="image" found in this loop');
      } else if (correctImages.length > 0) {
        console.log(`   ✅ SUMMARY: ${correctImages.length} image(s) with Alt Text="image" found`);
      }
      
      console.log('');
    });
    
    // Overall summary
    console.log('='.repeat(80));
    console.log('Overall Summary:');
    console.log('='.repeat(80));
    
    const totalLoops = loops.length;
    const loopsWithImages = loops.filter(l => l.imageCount > 0).length;
    const loopsWithCorrectAltText = loops.filter(l => 
      l.images.some(img => img.isImageAltText)
    ).length;
    
    console.log(`Total loops: ${totalLoops}`);
    console.log(`Loops with images: ${loopsWithImages}`);
    console.log(`Loops with Alt Text="image": ${loopsWithCorrectAltText}`);
    console.log('');
    
    if (loopsWithCorrectAltText < totalLoops) {
      console.log(`❌ PROBLEM: ${totalLoops - loopsWithCorrectAltText} loop(s) missing Alt Text="image"`);
      console.log('');
      console.log('💡 SOLUTION:');
      console.log('   1. Open template.docx in Word');
      console.log('   2. For each loop, find the image placeholder');
      console.log('   3. Right-click image → Format Picture → Alt Text');
      console.log('   4. Set Description to exactly "image" (without quotes)');
      console.log('   5. Make sure image is INSIDE the loop (between {{#d.images...}} and {{/d.images...}})');
    } else {
      console.log('✅ All loops have images with Alt Text="image"');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkLoopImagePlaceholderStructure();
}

module.exports = { checkLoopImagePlaceholderStructure };

