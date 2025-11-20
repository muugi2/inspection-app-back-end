const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function compareImageStructures() {
  try {
    console.log('='.repeat(80));
    console.log('Comparing loop image structure with signature image structure');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find signature image
    const signaturePattern = /\{\{d\.signatures\.inspector\}\}/;
    const sigMatch = xml.match(signaturePattern);
    
    if (sigMatch) {
      const sigIndex = xml.indexOf(sigMatch[0]);
      // Find image near signature (within 2000 chars)
      const sigContext = xml.substring(Math.max(0, sigIndex - 1000), sigIndex + 2000);
      
      // Find all images in signature context
      const sigImageMatches = [...sigContext.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
      
      console.log('Signature image structure:');
      console.log(`  Placeholder: ${sigMatch[0]}`);
      console.log(`  Images found: ${sigImageMatches.length}`);
      
      if (sigImageMatches.length > 0) {
        const sigImage = sigImageMatches[0][0];
        console.log(`  Image XML length: ${sigImage.length}`);
        
        // Extract key elements
        const hasBlip = /<a:blip[^>]*>/gi.test(sigImage);
        const hasPic = /<pic:pic[^>]*>/gi.test(sigImage);
        const hasInline = /<wp:inline[^>]*>/gi.test(sigImage);
        const hasAnchor = /<wp:anchor[^>]*>/gi.test(sigImage);
        const hasAltText = /descr=/gi.test(sigImage);
        const altText = sigImage.match(/descr=["']([^"']+)["']/gi)?.[0];
        const hasRId = /r:embed=/gi.test(sigImage);
        const rId = sigImage.match(/r:embed=["']([^"']+)["']/gi)?.[0];
        
        console.log(`  Has <a:blip>: ${hasBlip}`);
        console.log(`  Has <pic:pic>: ${hasPic}`);
        console.log(`  Has <wp:inline>: ${hasInline}`);
        console.log(`  Has <wp:anchor>: ${hasAnchor}`);
        console.log(`  Has Alt Text: ${hasAltText}`);
        console.log(`  Alt Text: ${altText || 'none'}`);
        console.log(`  Has r:embed: ${hasRId}`);
        console.log(`  r:embed: ${rId || 'none'}`);
        
        // Check if in paragraph
        const sigImageIndex = sigContext.indexOf(sigImage);
        const beforeImage = sigContext.substring(Math.max(0, sigImageIndex - 500), sigImageIndex);
        const afterImage = sigContext.substring(sigImageIndex + sigImage.length, sigImageIndex + sigImage.length + 500);
        const hasPBefore = /<w:p[^>]*>[\s\S]*$/gi.test(beforeImage);
        const hasPAfter = /^[\s\S]*<\/w:p>/gi.test(afterImage);
        console.log(`  In paragraph: ${hasPBefore && hasPAfter}`);
        
        console.log(`\n  Signature image XML preview (first 500 chars):`);
        console.log(`  ${sigImage.substring(0, 500)}...`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Loop image structure (first loop):');
    console.log('='.repeat(80));
    
    // Find first loop
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/;
    const loopMatch = xml.match(loopPattern);
    
    if (loopMatch) {
      const loopPath = loopMatch[1];
      const loopIndex = xml.indexOf(loopMatch[0]);
      
      // Find closing placeholder
      const closePattern = new RegExp(`\\{\\{/d\\.images\\.${loopPath.replace(/\./g, '\\.')}\\}\\}`);
      const closeMatch = xml.substring(loopIndex).match(closePattern);
      
      if (closeMatch) {
        const closeIndex = loopIndex + closeMatch.index;
        const loopContent = xml.substring(loopIndex, closeIndex + closeMatch[0].length);
        
        console.log(`  Loop: ${loopMatch[0]} ... ${closeMatch[0]}`);
        console.log(`  Path: ${loopPath}`);
        
        // Find image in loop
        const loopImageMatches = [...loopContent.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
        
        console.log(`  Images found: ${loopImageMatches.length}`);
        
        if (loopImageMatches.length > 0) {
          const loopImage = loopImageMatches[0][0];
          console.log(`  Image XML length: ${loopImage.length}`);
          
          // Extract key elements (same as signature)
          const hasBlip = /<a:blip[^>]*>/gi.test(loopImage);
          const hasPic = /<pic:pic[^>]*>/gi.test(loopImage);
          const hasInline = /<wp:inline[^>]*>/gi.test(loopImage);
          const hasAnchor = /<wp:anchor[^>]*>/gi.test(loopImage);
          const hasAltText = /descr=/gi.test(loopImage);
          const altText = loopImage.match(/descr=["']([^"']+)["']/gi)?.[0];
          const hasRId = /r:embed=/gi.test(loopImage);
          const rId = loopImage.match(/r:embed=["']([^"']+)["']/gi)?.[0];
          
          console.log(`  Has <a:blip>: ${hasBlip}`);
          console.log(`  Has <pic:pic>: ${hasPic}`);
          console.log(`  Has <wp:inline>: ${hasInline}`);
          console.log(`  Has <wp:anchor>: ${hasAnchor}`);
          console.log(`  Has Alt Text: ${hasAltText}`);
          console.log(`  Alt Text: ${altText || 'none'}`);
          console.log(`  Has r:embed: ${hasRId}`);
          console.log(`  r:embed: ${rId || 'none'}`);
          
          // Check if in paragraph
          const loopImageIndex = loopContent.indexOf(loopImage);
          const beforeImage = loopContent.substring(Math.max(0, loopImageIndex - 500), loopImageIndex);
          const afterImage = loopContent.substring(loopImageIndex + loopImage.length, loopImageIndex + loopImage.length + 500);
          const hasPBefore = /<w:p[^>]*>[\s\S]*$/gi.test(beforeImage);
          const hasPAfter = /^[\s\S]*<\/w:p>/gi.test(afterImage);
          console.log(`  In paragraph: ${hasPBefore && hasPAfter}`);
          
          console.log(`\n  Loop image XML preview (first 500 chars):`);
          console.log(`  ${loopImage.substring(0, 500)}...`);
          
          // Compare structures
          console.log('\n' + '='.repeat(80));
          console.log('Comparison:');
          console.log('='.repeat(80));
          
          // Get signature image from earlier
          const sigContext2 = xml.substring(Math.max(0, xml.indexOf(/\{\{d\.signatures\.inspector\}\}/.exec(xml)?.index || 0) - 1000), (/\{\{d\.signatures\.inspector\}\}/.exec(xml)?.index || 0) + 2000);
          const sigImageMatches2 = [...sigContext2.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
          
          if (sigImageMatches2.length > 0) {
            const sigImage = sigImageMatches2[0][0];
            const sigHasBlip = /<a:blip[^>]*>/gi.test(sigImage);
            const sigHasPic = /<pic:pic[^>]*>/gi.test(sigImage);
            const sigHasInline = /<wp:inline[^>]*>/gi.test(sigImage);
            const sigAltText = sigImage.match(/descr=["']([^"']+)["']/gi)?.[0];
            
            console.log(`  <a:blip>: Signature=${sigHasBlip}, Loop=${hasBlip}, Match=${sigHasBlip === hasBlip}`);
            console.log(`  <pic:pic>: Signature=${sigHasPic}, Loop=${hasPic}, Match=${sigHasPic === hasPic}`);
            console.log(`  <wp:inline>: Signature=${sigHasInline}, Loop=${hasInline}, Match=${sigHasInline === hasInline}`);
            console.log(`  Alt Text: Signature=${sigAltText || 'none'}, Loop=${altText || 'none'}, Match=${sigAltText === altText}`);
            
            // Check if structures are similar
            const structuresMatch = 
              sigHasBlip === hasBlip &&
              sigHasPic === hasPic &&
              sigHasInline === hasInline;
            
            console.log(`\n  Structures match: ${structuresMatch}`);
            
            if (!structuresMatch) {
              console.log(`  ⚠️  WARNING: Image structures differ!`);
              console.log(`     This might prevent easy-template-x from replacing loop images.`);
            } else {
              console.log(`  ✅ Image structures are similar`);
              console.log(`  💡 The issue might be in how easy-template-x processes loop images.`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  compareImageStructures();
}

module.exports = { compareImageStructures };

