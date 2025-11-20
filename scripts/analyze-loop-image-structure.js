const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function analyzeLoopImageStructure() {
  try {
    console.log('='.repeat(80));
    console.log('Analyzing loop and image placeholder structure');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all loop placeholders
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
    const loops = [];
    let match;
    
    while ((match = loopPattern.exec(xml)) !== null) {
      const path = match[1];
      const openIndex = match.index;
      const openFull = match[0];
      
      // Find closing placeholder
      const closePattern = new RegExp(`\\{\\{/d\\.images\\.${path.replace(/\./g, '\\.')}\\}\\}`);
      const closeMatch = xml.substring(openIndex).match(closePattern);
      
      if (closeMatch) {
        const closeIndex = openIndex + closeMatch.index;
        const closeFull = closeMatch[0];
        const loopContent = xml.substring(openIndex, closeIndex + closeFull.length);
        
        // Find image placeholders (Alt Text = "image") in this loop
        const imageAltTextMatches = loopContent.match(/descr=["']image["']/gi) || [];
        
        // Find image XML structure
        const imageDrawingMatches = [...loopContent.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
        
        loops.push({
          path,
          openFull,
          closeFull,
          loopContent,
          imageAltTextCount: imageAltTextMatches.length,
          imageDrawingCount: imageDrawingMatches.length,
          imageDrawings: imageDrawingMatches.map(m => ({
            full: m[0].substring(0, 200),
            hasAltText: /descr=["']image["']/gi.test(m[0]),
            altText: m[0].match(/descr=["']([^"']+)["']/gi)?.[0],
          })),
        });
      }
    }
    
    console.log(`Found ${loops.length} loops\n`);
    
    loops.forEach((loop, i) => {
      console.log(`${i + 1}. ${loop.path}:`);
      console.log(`   Loop: ${loop.openFull} ... ${loop.closeFull}`);
      console.log(`   Image Alt Text="image" count: ${loop.imageAltTextCount}`);
      console.log(`   Image <w:drawing> count: ${loop.imageDrawingCount}`);
      
      if (loop.imageDrawings.length > 0) {
        console.log(`   Image structures:`);
        loop.imageDrawings.forEach((img, j) => {
          console.log(`     ${j + 1}. Has Alt Text="image": ${img.hasAltText}`);
          console.log(`        Alt Text: ${img.altText || 'none'}`);
          console.log(`        XML preview: ${img.full.substring(0, 100)}...`);
        });
      }
      
      // Check if image is inside a paragraph
      const imageInParagraph = /<w:p[^>]*>[\s\S]*?<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>[\s\S]*?<\/w:p>/gi.test(loop.loopContent);
      console.log(`   Image in paragraph: ${imageInParagraph}`);
      
      // Check if image is directly after loop opening
      const loopContentStart = loop.loopContent.indexOf(loop.openFull) + loop.openFull.length;
      const firstImageAfterLoop = loop.loopContent.substring(loopContentStart, loopContentStart + 500);
      const hasImageAfterLoop = /<w:drawing[^>]*>[\s\S]*?descr=["']image["']/gi.test(firstImageAfterLoop);
      console.log(`   Image directly after loop opening: ${hasImageAfterLoop}`);
      
      console.log('');
    });
    
    // Compare with signature image structure
    console.log('='.repeat(80));
    console.log('Comparing with signature image structure:');
    console.log('='.repeat(80));
    
    const signaturePattern = /\{\{d\.signatures\.inspector\}\}/g;
    const signatureMatch = xml.match(signaturePattern);
    
    if (signatureMatch) {
      const sigIndex = xml.indexOf(signatureMatch[0]);
      const sigContext = xml.substring(Math.max(0, sigIndex - 500), sigIndex + 1000);
      
      const sigImageMatches = [...sigContext.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
      console.log(`Signature placeholder: ${signatureMatch[0]}`);
      console.log(`Images near signature: ${sigImageMatches.length}`);
      
      sigImageMatches.forEach((img, i) => {
        const hasAltText = /descr=/gi.test(img[0]);
        const altText = img[0].match(/descr=["']([^"']+)["']/gi)?.[0];
        console.log(`  Image ${i + 1}: Has Alt Text: ${hasAltText}, Alt Text: ${altText || 'none'}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log('='.repeat(80));
    console.log(`Total loops: ${loops.length}`);
    console.log(`Loops with images (Alt Text="image"): ${loops.filter(l => l.imageAltTextCount > 0).length}`);
    console.log(`Loops with <w:drawing>: ${loops.filter(l => l.imageDrawingCount > 0).length}`);
    
    const loopsWithCorrectImage = loops.filter(l => 
      l.imageAltTextCount > 0 && 
      l.imageDrawings.some(img => img.hasAltText)
    );
    console.log(`Loops with correct image structure: ${loopsWithCorrectImage.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  analyzeLoopImageStructure();
}

module.exports = { analyzeLoopImageStructure };

