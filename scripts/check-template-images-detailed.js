const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkTemplateImagesDetailed() {
  try {
    console.log('='.repeat(80));
    console.log('Template Image Placeholder Detailed Check');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // 1. Check for "image" text nodes (WRONG - should be placeholder images)
    const imageTextNodes = [...xml.matchAll(/<w:t[^>]*>image<\/w:t>/gi)];
    console.log(`1. "image" text nodes found: ${imageTextNodes.length}`);
    if (imageTextNodes.length > 0) {
      console.log('   ❌ PROBLEM: Found "image" as TEXT, not as placeholder image!');
      console.log('   These should be replaced with actual placeholder images (Alt Text = "image")');
      console.log('   Sample locations:');
      imageTextNodes.slice(0, 5).forEach((match, i) => {
        const before = xml.substring(Math.max(0, match.index - 100), match.index);
        const after = xml.substring(match.index, Math.min(xml.length, match.index + 100));
        console.log(`   ${i+1}. ...${before.substring(before.length - 50)}[image]${after.substring(0, 50)}...`);
      });
    } else {
      console.log('   ✅ No "image" text nodes found (good!)');
    }
    console.log('');
    
    // 2. Check for image Alt Text placeholders
    const imageAltTexts = xml.match(/descr=["']image["']/gi) || [];
    console.log(`2. Image Alt Text placeholders (descr="image"): ${imageAltTexts.length}`);
    if (imageAltTexts.length === 0) {
      console.log('   ❌ PROBLEM: No placeholder images with Alt Text="image" found!');
      console.log('   Need to add placeholder images with Alt Text="image" inside loops');
    } else {
      console.log(`   ✅ Found ${imageAltTexts.length} placeholder images`);
    }
    console.log('');
    
    // 3. Check loops and their image placeholders
    const loopMatches = [...xml.matchAll(/\{\{#d\.images\.([^\}]+)\}\}/g)];
    console.log(`3. Loop placeholders found: ${loopMatches.length}`);
    
    const loopInfo = {};
    loopMatches.forEach(match => {
      const path = match[1];
      const openIndex = match.index;
      const closeMatch = xml.substring(openIndex).match(new RegExp(`\\{\\{/d\\.images\\.${path.replace(/\./g, '\\.')}\\}\\}`));
      const closeIndex = closeMatch ? openIndex + closeMatch.index : -1;
      
      if (closeIndex > openIndex) {
        const loopContent = xml.substring(openIndex, closeIndex + closeMatch[0].length);
        const hasImageAltText = /descr=["']image["']/gi.test(loopContent);
        const hasImageText = /<w:t[^>]*>image<\/w:t>/gi.test(loopContent);
        
        loopInfo[path] = {
          hasImageAltText,
          hasImageText,
          hasBoth: hasImageAltText && hasImageText,
        };
      }
    });
    
    console.log('\n4. Loop analysis:');
    let problemsFound = 0;
    Object.entries(loopInfo).forEach(([path, info]) => {
      if (!info.hasImageAltText && !info.hasImageText) {
        console.log(`   ❌ ${path}: No image placeholder found (neither Alt Text nor text)`);
        problemsFound++;
      } else if (info.hasImageText && !info.hasImageAltText) {
        console.log(`   ❌ ${path}: Has "image" TEXT but no placeholder image (Alt Text="image")`);
        problemsFound++;
      } else if (info.hasImageAltText && info.hasImageText) {
        console.log(`   ⚠️  ${path}: Has both "image" text AND placeholder image (remove text!)`);
        problemsFound++;
      } else if (info.hasImageAltText) {
        console.log(`   ✅ ${path}: Has placeholder image (Alt Text="image")`);
      }
    });
    
    console.log('');
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log(`  Total loops: ${loopMatches.length}`);
    console.log(`  Problems found: ${problemsFound}`);
    console.log(`  Image Alt Text placeholders: ${imageAltTexts.length}`);
    console.log(`  "image" text nodes: ${imageTextNodes.length}`);
    console.log('');
    
    if (imageTextNodes.length > 0) {
      console.log('❌ MAIN PROBLEM: Template has "image" as TEXT instead of placeholder images!');
      console.log('');
      console.log('SOLUTION:');
      console.log('1. Find all "image" text in the template');
      console.log('2. Delete the text "image"');
      console.log('3. Insert → Pictures → Placeholder image');
      console.log('4. Set Alt Text → Description = "image"');
      console.log('5. The placeholder image should be INSIDE the loop (between {{#d.images...}} and {{/d.images...}})');
    } else if (imageAltTexts.length === 0) {
      console.log('❌ MAIN PROBLEM: No placeholder images found!');
      console.log('');
      console.log('SOLUTION:');
      console.log('1. Inside each loop ({{#d.images...}} ... {{/d.images...}})');
      console.log('2. Insert → Pictures → Placeholder image');
      console.log('3. Set Alt Text → Description = "image"');
    } else {
      console.log('✅ Template structure looks correct!');
      console.log('   If images still not loading, check:');
      console.log('   - Backend logs for image loading errors');
      console.log('   - Base64 conversion errors');
      console.log('   - Easy Template X processing errors');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkTemplateImagesDetailed();
}

module.exports = { checkTemplateImagesDetailed };





