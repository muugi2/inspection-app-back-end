const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function checkImageInLoop() {
  try {
    console.log('='.repeat(80));
    console.log('Checking if image placeholders are inside loops');
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
    
    console.log(`Found ${openLoops.length} opening loops and ${closeLoops.length} closing loops\n`);
    
    // Match open and close loops
    const matchedLoops = [];
    
    openLoops.forEach(open => {
      const close = closeLoops.find(c => 
        c.path === open.path && c.index > open.index
      );
      
      if (close) {
        // Extract content between open and close
        const contentStart = open.index + open.full.length;
        const contentEnd = close.index;
        const content = xml.substring(contentStart, contentEnd);
        
        // Find all image Alt Text placeholders in this loop
        const imageAltTextMatches = (content.match(/descr=["']image["']/gi) || []);
        
        matchedLoops.push({
          path: open.path,
          open: open,
          close: close,
          content: content,
          imageCount: imageAltTextMatches.length,
        });
      }
    });
    
    console.log('Loop Image Placeholder Analysis:');
    console.log('-'.repeat(80));
    
    matchedLoops.forEach((loop, i) => {
      const [section, ...fieldParts] = loop.path.split('.');
      const field = fieldParts.join('.');
      
      console.log(`\n${i + 1}. ${section}.${field}:`);
      console.log(`   Loop: ${loop.open.full} ... ${loop.close.full}`);
      console.log(`   Images inside loop: ${loop.imageCount}`);
      
      if (loop.imageCount === 0) {
        console.log(`   ❌ PROBLEM: No image placeholder (Alt Text="image") found inside loop!`);
        console.log(`   💡 SOLUTION: Insert placeholder image between ${loop.open.full} and ${loop.close.full}`);
      } else if (loop.imageCount > 1) {
        console.log(`   ⚠️  WARNING: Multiple images (${loop.imageCount}) - only first will be used by loop`);
      } else {
        console.log(`   ✅ OK: One image placeholder found inside loop`);
      }
    });
    
    // Check for image placeholders OUTSIDE of loops
    console.log('\n' + '='.repeat(80));
    console.log('Checking for image placeholders OUTSIDE of loops:');
    console.log('-'.repeat(80));
    
    // Find all image Alt Text placeholders
    const allImagePattern = /<w:drawing[^>]*>[\s\S]*?descr=["']image["'][\s\S]*?<\/w:drawing>/gi;
    const allImages = [];
    let imageMatch;
    
    while ((imageMatch = allImagePattern.exec(xml)) !== null) {
      const imageIndex = imageMatch.index;
      const imageEnd = imageMatch.index + imageMatch[0].length;
      
      // Check if this image is inside any loop
      const isInsideLoop = matchedLoops.some(loop => {
        const loopStart = loop.open.index;
        const loopEnd = loop.close.index + loop.close.full.length;
        return imageIndex >= loopStart && imageIndex <= loopEnd;
      });
      
      if (!isInsideLoop) {
        // Find nearby text to identify the image
        const beforeText = xml.substring(Math.max(0, imageIndex - 200), imageIndex);
        const afterText = xml.substring(imageEnd, Math.min(xml.length, imageEnd + 200));
        const contextBefore = beforeText.match(/<w:t[^>]*>([^<]{0,50})<\/w:t>/g)?.slice(-2).join(' ') || '';
        const contextAfter = afterText.match(/<w:t[^>]*>([^<]{0,50})<\/w:t>/g)?.slice(0, 2).join(' ') || '';
        
        allImages.push({
          index: imageIndex,
          contextBefore: contextBefore.replace(/<[^>]+>/g, '').trim(),
          contextAfter: contextAfter.replace(/<[^>]+>/g, '').trim(),
        });
      }
    }
    
    if (allImages.length > 0) {
      console.log(`\n❌ Found ${allImages.length} image placeholder(s) OUTSIDE of loops:`);
      allImages.slice(0, 10).forEach((img, i) => {
        console.log(`   ${i + 1}. Image placeholder at index ${img.index}`);
        if (img.contextBefore) {
          console.log(`      Before: "${img.contextBefore.substring(0, 50)}..."`);
        }
        if (img.contextAfter) {
          console.log(`      After: "${img.contextAfter.substring(0, 50)}..."`);
        }
      });
      console.log(`\n💡 SOLUTION: These images should be inside a loop ({{#d.images...}} ... {{/d.images...}})`);
    } else {
      console.log('\n✅ All image placeholders are inside loops (or no images found)');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary:');
    console.log('-'.repeat(80));
    console.log(`Total loops found: ${matchedLoops.length}`);
    console.log(`Total image placeholders: ${allImages.length + matchedLoops.reduce((sum, l) => sum + l.imageCount, 0)}`);
    console.log(`Images inside loops: ${matchedLoops.reduce((sum, l) => sum + l.imageCount, 0)}`);
    console.log(`Images outside loops: ${allImages.length}`);
    
    if (matchedLoops.some(l => l.imageCount === 0)) {
      console.log('\n❌ ISSUES FOUND:');
      console.log('   Some loops have no image placeholder inside them');
    }
    
    if (allImages.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      console.log('   Some image placeholders are outside of loops');
    }
    
    if (matchedLoops.every(l => l.imageCount > 0) && allImages.length === 0) {
      console.log('\n✅ No issues found with image placement in loops!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkImageInLoop();
}

module.exports = { checkImageInLoop };

