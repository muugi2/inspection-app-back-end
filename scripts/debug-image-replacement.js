const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function debugImageReplacement() {
  try {
    console.log('='.repeat(80));
    console.log('Debugging image replacement in template');
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
    
    console.log(`Found ${openLoops.length} loops to analyze\n`);
    
    // Load relationships once
    let relsXml = null;
    try {
      const relsFile = zip.file('word/_rels/document.xml.rels');
      if (relsFile) {
        relsXml = await relsFile.async('string');
      }
    } catch (relError) {
      console.log('Could not load relationships file');
    }
    
    // Analyze each loop
    for (let i = 0; i < openLoops.length; i++) {
      const open = openLoops[i];
      const close = closeLoops.find(c => 
        c.path === open.path && c.index > open.index
      );
      
      if (!close) {
        console.log(`${i + 1}. ${open.path}: ❌ No matching closing tag`);
        continue;
      }
      
      // Extract content between open and close
      const contentStart = open.index + open.full.length;
      const contentEnd = close.index;
      const loopContent = xml.substring(contentStart, contentEnd);
      
      // Find all image placeholders in this loop
      const imageAltTextMatches = (loopContent.match(/descr=["']image["']/gi) || []);
      const imageTextMatches = (loopContent.match(/<w:t[^>]*>image<\/w:t>/gi) || []);
      
      console.log(`${i + 1}. ${open.path}:`);
      console.log(`   Loop: ${open.full} ... ${close.full}`);
      console.log(`   Image Alt Text="image": ${imageAltTextMatches.length}`);
      console.log(`   "image" text nodes: ${imageTextMatches.length}`);
      
      if (imageAltTextMatches.length === 0) {
        console.log(`   ❌ PROBLEM: No image placeholder with Alt Text="image" found!`);
        console.log(`   💡 SOLUTION: Insert placeholder image between ${open.full} and ${close.full}`);
      } else if (imageAltTextMatches.length > 1) {
        console.log(`   ⚠️  WARNING: Multiple images (${imageAltTextMatches.length}) - only first will be used`);
      } else {
        // Check if image is in correct format
        const imageRegex = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi;
        const imageMatch = imageRegex.exec(loopContent);
        
        if (imageMatch) {
          const imageXml = imageMatch[0];
          console.log(`   ✅ Image placeholder found`);
          
          // Check image structure
          const hasBlip = imageXml.includes('<a:blip');
          const hasPic = imageXml.includes('<pic:pic');
          const hasRelId = imageXml.match(/r:embed="([^"]+)"/);
          
          console.log(`   Image structure:`);
          console.log(`     - Has <a:blip>: ${hasBlip}`);
          console.log(`     - Has <pic:pic>: ${hasPic}`);
          console.log(`     - Has r:embed: ${!!hasRelId}`);
          
          if (hasRelId) {
            const relId = hasRelId[1];
            console.log(`     - Relationship ID: ${relId}`);
            
            // Check if relationship exists
            if (relsXml) {
              try {
                const relPattern = new RegExp(`<Relationship[^>]*Id="${relId}"[^>]*Target="([^"]+)"`, 'i');
                const relMatch = relsXml.match(relPattern);
                
                if (relMatch) {
                  const target = relMatch[1];
                  console.log(`     - Relationship target: ${target}`);
                  
                  // Check if image file exists
                  const imagePath = target.replace(/^media\//, 'word/media/');
                  const imageFile = zip.file(imagePath);
                  
                  if (imageFile) {
                    console.log(`     - Image file exists in template: ✅`);
                  } else {
                    console.log(`     - Image file exists in template: ❌`);
                  }
                } else {
                  console.log(`     - Relationship not found: ❌`);
                }
              } catch (relError) {
                console.log(`     - Could not check relationship: ${relError.message}`);
              }
            }
          }
        } else {
          console.log(`   ⚠️  Alt Text found but image structure might be incorrect`);
        }
      }
      
      if (imageTextMatches.length > 0) {
        console.log(`   ⚠️  WARNING: Found "image" as text - should be a placeholder image instead`);
      }
      
      console.log('');
    }
    
    // Compare with signature image placeholder
    console.log('='.repeat(80));
    console.log('Comparing with signature image placeholder:');
    console.log('-'.repeat(80));
    
    const signaturePattern = /descr=["']\{\{d\.signatures\.inspector\}\}["']/gi;
    const signatureMatches = xml.match(signaturePattern) || [];
    
    console.log(`Signature placeholder ({{d.signatures.inspector}}): ${signatureMatches.length} found`);
    
    if (signatureMatches.length > 0) {
      // Find signature image structure
      const sigImageRegex = /<w:drawing[^>]*>[\s\S]*?descr=["']\{\{d\.signatures\.inspector\}\}["'][\s\S]*?<\/w:drawing>/gi;
      const sigImageMatch = sigImageRegex.exec(xml);
      
      if (sigImageMatch) {
        const sigImageXml = sigImageMatch[0];
        console.log(`Signature image structure:`);
        console.log(`  - Has <a:blip>: ${sigImageXml.includes('<a:blip')}`);
        console.log(`  - Has <pic:pic>: ${sigImageXml.includes('<pic:pic')}`);
        console.log(`  - Has r:embed: ${!!sigImageXml.match(/r:embed="([^"]+)"/)}`);
        console.log('');
        
        // Compare structure
        if (openLoops.length > 0) {
          const firstLoop = openLoops[0];
          const closeLoop = closeLoops.find(c => c.path === firstLoop.path && c.index > firstLoop.index);
          
          if (closeLoop) {
            const loopContent = xml.substring(firstLoop.index + firstLoop.full.length, closeLoop.index);
            const loopImageRegex = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi;
            const loopImageMatch = loopImageRegex.exec(loopContent);
            
            if (loopImageMatch) {
              const loopImageXml = loopImageMatch[0];
              console.log(`Comparing structures:`);
              console.log(`  Signature image: ${sigImageXml.length} bytes`);
              console.log(`  Loop image: ${loopImageXml.length} bytes`);
              
              // Check if structures are similar
              const sigHasBlip = sigImageXml.includes('<a:blip');
              const loopHasBlip = loopImageXml.includes('<a:blip');
              const sigHasPic = sigImageXml.includes('<pic:pic');
              const loopHasPic = loopImageXml.includes('<pic:pic');
              
              if (sigHasBlip && !loopHasBlip) {
                console.log(`  ❌ PROBLEM: Loop image missing <a:blip> element!`);
              }
              if (sigHasPic && !loopHasPic) {
                console.log(`  ❌ PROBLEM: Loop image missing <pic:pic> element!`);
              }
              if (sigHasBlip === loopHasBlip && sigHasPic === loopHasPic) {
                console.log(`  ✅ Image structures are similar`);
              }
            }
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log('-'.repeat(80));
    console.log(`Total loops: ${openLoops.length}`);
    console.log(`Signature placeholders: ${signatureMatches.length}`);
    console.log('');
    console.log('💡 Check:');
    console.log('  1. Are image placeholders inside loops?');
    console.log('  2. Is Alt Text exactly "image" (not "{{image}}" or other)?');
    console.log('  3. Is image structure correct (has <a:blip>, <pic:pic>)?');
    console.log('  4. Does image have relationship ID (r:embed)?');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  debugImageReplacement();
}

module.exports = { debugImageReplacement };

