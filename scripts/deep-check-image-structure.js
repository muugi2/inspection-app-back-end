const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function deepCheckImageStructure() {
  try {
    console.log('='.repeat(80));
    console.log('Deep check: Image placeholder structure in loops');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all loop placeholders
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
    const closingPattern = /\{\{\/d\.images\.([^\}]+)\}\}/g;
    
    const openLoops = [];
    let match;
    while ((match = loopPattern.exec(xml)) !== null) {
      openLoops.push({
        full: match[0],
        path: match[1],
        index: match.index,
      });
    }
    
    const closeLoops = [];
    while ((match = closingPattern.exec(xml)) !== null) {
      closeLoops.push({
        full: match[0],
        path: match[1],
        index: match.index,
      });
    }
    
    console.log(`Found ${openLoops.length} loops to check\n`);
    
    // Check each loop
    for (let i = 0; i < openLoops.length; i++) {
      const open = openLoops[i];
      const close = closeLoops.find(c => 
        c.path === open.path && c.index > open.index
      );
      
      if (!close) {
        console.log(`${i + 1}. ${open.path}: ❌ No matching closing tag\n`);
        continue;
      }
      
      // Extract content between open and close
      const contentStart = open.index + open.full.length;
      const contentEnd = close.index;
      const loopContent = xml.substring(contentStart, contentEnd);
      
      console.log(`${i + 1}. ${open.path}:`);
      console.log(`   Loop: ${open.full} ... ${close.full}`);
      console.log(`   Content length: ${loopContent.length} bytes\n`);
      
      // Find all image placeholders in this loop
      const imageRegex = /<w:drawing[^>]*>[\s\S]*?<\/w:drawing>/gi;
      const images = [];
      let imageMatch;
      
      while ((imageMatch = imageRegex.exec(loopContent)) !== null) {
        const imageXml = imageMatch[0];
        const altTextMatch = imageXml.match(/descr=["']([^"']+)["']/i) || 
                            imageXml.match(/name=["']([^"']+)["']/i);
        const altText = altTextMatch ? altTextMatch[1] : null;
        
        images.push({
          xml: imageXml.substring(0, 200),
          altText: altText,
          position: imageMatch.index,
        });
      }
      
      console.log(`   Found ${images.length} image(s) in loop:`);
      images.forEach((img, idx) => {
        console.log(`     ${idx + 1}. Alt Text: "${img.altText || 'NOT FOUND'}"`);
        console.log(`        Position: ${img.position}`);
        if (img.altText === 'image') {
          console.log(`        ✅ Correct Alt Text`);
        } else if (img.altText && img.altText.includes('{{')) {
          console.log(`        ❌ PROBLEM: Has placeholder in Alt Text: "${img.altText}"`);
          console.log(`        💡 SOLUTION: Change to just "image" (without {{}})`);
        } else if (!img.altText) {
          console.log(`        ❌ PROBLEM: No Alt Text found!`);
        } else {
          console.log(`        ⚠️  Alt Text is not "image": "${img.altText}"`);
        }
      });
      
      // Check if image is in paragraph (required for easy-template-x)
      if (images.length > 0) {
        const firstImage = images[0];
        const imageContextStart = Math.max(0, contentStart + firstImage.position - 500);
        const imageContextEnd = Math.min(xml.length, contentStart + firstImage.position + 500);
        const imageContext = xml.substring(imageContextStart, imageContextEnd);
        
        // Check if image is in paragraph
        const hasParagraphBefore = imageContext.match(/<w:p[^>]*>/);
        const hasParagraphAfter = imageContext.match(/<\/w:p>/);
        
        console.log(`        Paragraph check:`);
        console.log(`          - Has <w:p> before: ${!!hasParagraphBefore}`);
        console.log(`          - Has </w:p> after: ${!!hasParagraphAfter}`);
        
        if (!hasParagraphBefore || !hasParagraphAfter) {
          console.log(`        ⚠️  WARNING: Image might not be in a paragraph`);
        }
      }
      
      console.log('');
    }
    
    // Compare with signature image
    console.log('='.repeat(80));
    console.log('Comparing with signature image:');
    console.log('-'.repeat(80));
    
    const sigImageRegex = /<w:drawing[^>]*>[\s\S]*?descr=["']\{\{d\.signatures\.inspector\}\}["'][\s\S]*?<\/w:drawing>/gi;
    const sigImageMatch = sigImageRegex.exec(xml);
    
    if (sigImageMatch) {
      const sigImageXml = sigImageMatch[0];
      const sigAltText = sigImageXml.match(/descr=["']([^"']+)["']/i)?.[1];
      
      console.log(`Signature image:`);
      console.log(`  Alt Text: "${sigAltText}"`);
      console.log(`  XML length: ${sigImageXml.length} bytes`);
      
      // Check signature image context
      const sigContextStart = Math.max(0, sigImageMatch.index - 500);
      const sigContextEnd = Math.min(xml.length, sigImageMatch.index + sigImageXml.length + 500);
      const sigContext = xml.substring(sigContextStart, sigContextEnd);
      
      const sigHasParagraphBefore = sigContext.match(/<w:p[^>]*>/);
      const sigHasParagraphAfter = sigContext.match(/<\/w:p>/);
      
      console.log(`  Paragraph check:`);
      console.log(`    - Has <w:p> before: ${!!sigHasParagraphBefore}`);
      console.log(`    - Has </w:p> after: ${!!sigHasParagraphAfter}`);
      console.log('');
      
      // Compare structures
      if (openLoops.length > 0) {
        const firstLoop = openLoops[0];
        const closeLoop = closeLoops.find(c => c.path === firstLoop.path && c.index > firstLoop.index);
        
        if (closeLoop) {
          const loopContent = xml.substring(firstLoop.index + firstLoop.full.length, closeLoop.index);
          const loopImageRegex = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi;
          const loopImageMatch = loopImageRegex.exec(loopContent);
          
          if (loopImageMatch) {
            const loopImageXml = loopImageMatch[0];
            console.log(`Comparison:`);
            console.log(`  Signature: Alt Text="${sigAltText}", length=${sigImageXml.length}`);
            console.log(`  Loop image: Alt Text="image", length=${loopImageXml.length}`);
            
            // Check key differences
            const sigHasBlip = sigImageXml.includes('<a:blip');
            const loopHasBlip = loopImageXml.includes('<a:blip');
            const sigHasPic = sigImageXml.includes('<pic:pic');
            const loopHasPic = loopImageXml.includes('<pic:pic');
            
            console.log(`  Structures:`);
            console.log(`    Signature: <a:blip>=${sigHasBlip}, <pic:pic>=${sigHasPic}`);
            console.log(`    Loop: <a:blip>=${loopHasBlip}, <pic:pic>=${loopHasPic}`);
            
            if (sigHasBlip === loopHasBlip && sigHasPic === loopHasPic) {
              console.log(`  ✅ Structures are similar`);
            } else {
              console.log(`  ❌ Structures differ - this might be the issue!`);
            }
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log('-'.repeat(80));
    console.log(`Total loops: ${openLoops.length}`);
    console.log(`Each loop should have 1 image with Alt Text="image"`);
    console.log('');
    console.log('💡 Check:');
    console.log('  1. Is Alt Text exactly "image" (not "{{image}}" or other)?');
    console.log('  2. Is image in a paragraph (<w:p>)?');
    console.log('  3. Does image structure match signature image?');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  deepCheckImageStructure();
}

module.exports = { deepCheckImageStructure };

