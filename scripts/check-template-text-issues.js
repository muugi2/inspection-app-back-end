const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function checkTemplateTextIssues() {
  try {
    console.log('='.repeat(80));
    console.log('Template Text Issues Analysis');
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
        
        // Check for "image" text node
        const imageTextMatches = loopContent.match(/<w:t[^>]*>image<\/w:t>/gi) || [];
        const imageTextCount = imageTextMatches.length;
        
        // Check for image Alt Text placeholder
        const imageAltTextMatches = loopContent.match(/descr=["']image["']/gi) || [];
        const imageAltTextCount = imageAltTextMatches.length;
        
        loops.push({
          path,
          openFull,
          closeFull,
          hasImageText: imageTextCount > 0,
          imageTextCount,
          hasImageAltText: imageAltTextCount > 0,
          imageAltTextCount,
          loopContent: loopContent.substring(0, 500), // First 500 chars for debugging
        });
      }
    }
    
    console.log(`Found ${loops.length} loops\n`);
    console.log('='.repeat(80));
    console.log('ISSUES FOUND:');
    console.log('='.repeat(80));
    console.log('');
    
    const issues = [];
    
    loops.forEach((loop, i) => {
      console.log(`${i + 1}. ${loop.path}:`);
      
      if (loop.hasImageText && !loop.hasImageAltText) {
        console.log(`   ❌ PROBLEM: Has "image" TEXT but NO placeholder image with Alt Text="image"`);
        console.log(`      - "image" text nodes: ${loop.imageTextCount}`);
        console.log(`      - Image Alt Text placeholders: ${loop.imageAltTextCount}`);
        issues.push({
          type: 'text_instead_of_image',
          path: loop.path,
          message: 'Has "image" text but no placeholder image with Alt Text="image"',
        });
      } else if (!loop.hasImageText && !loop.hasImageAltText) {
        console.log(`   ❌ PROBLEM: NO placeholder image with Alt Text="image"`);
        console.log(`      - "image" text nodes: ${loop.imageTextCount}`);
        console.log(`      - Image Alt Text placeholders: ${loop.imageAltTextCount}`);
        issues.push({
          type: 'missing_image_placeholder',
          path: loop.path,
          message: 'Missing placeholder image with Alt Text="image"',
        });
      } else if (loop.hasImageText && loop.hasImageAltText) {
        console.log(`   ⚠️  WARNING: Has BOTH "image" text AND placeholder image`);
        console.log(`      - "image" text nodes: ${loop.imageTextCount}`);
        console.log(`      - Image Alt Text placeholders: ${loop.imageAltTextCount}`);
        issues.push({
          type: 'both_text_and_image',
          path: loop.path,
          message: 'Has both "image" text and placeholder image - should only have placeholder image',
        });
      } else {
        console.log(`   ✅ OK: Has placeholder image with Alt Text="image"`);
        console.log(`      - Image Alt Text placeholders: ${loop.imageAltTextCount}`);
      }
      console.log('');
    });
    
    // Check for field name mismatches
    console.log('='.repeat(80));
    console.log('FIELD NAME MISMATCHES:');
    console.log('='.repeat(80));
    console.log('');
    
    const fieldMismatches = [];
    
    // Check indicator.seal_and_bolt vs seal_bolt
    const sealAndBoltLoops = loops.filter(l => l.path.includes('seal_and_bolt'));
    if (sealAndBoltLoops.length > 0) {
      console.log('❌ Template uses "seal_and_bolt" but code expects "seal_bolt"');
      sealAndBoltLoops.forEach(loop => {
        console.log(`   - ${loop.path}`);
        fieldMismatches.push({
          template: loop.path,
          code: loop.path.replace('seal_and_bolt', 'seal_bolt'),
        });
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Total loops: ${loops.length}`);
    console.log(`Issues found: ${issues.length}`);
    console.log(`Field name mismatches: ${fieldMismatches.length}`);
    console.log('');
    
    if (issues.length > 0) {
      console.log('ISSUE BREAKDOWN:');
      const issueTypes = {};
      issues.forEach(issue => {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      });
      Object.entries(issueTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
      console.log('');
    }
    
    // Copy-paste friendly report
    console.log('='.repeat(80));
    console.log('COPY-PASTE FRIENDLY REPORT:');
    console.log('='.repeat(80));
    console.log('');
    
    const textInsteadOfImage = issues.filter(i => i.type === 'text_instead_of_image');
    if (textInsteadOfImage.length > 0) {
      console.log('LOOPS WITH "image" TEXT (need to replace with placeholder image):');
      textInsteadOfImage.forEach(issue => {
        console.log(`  ❌ ${issue.path}`);
      });
      console.log('');
    }
    
    const missingImage = issues.filter(i => i.type === 'missing_image_placeholder');
    if (missingImage.length > 0) {
      console.log('LOOPS MISSING PLACEHOLDER IMAGE:');
      missingImage.forEach(issue => {
        console.log(`  ❌ ${issue.path}`);
      });
      console.log('');
    }
    
    if (fieldMismatches.length > 0) {
      console.log('FIELD NAME MISMATCHES:');
      fieldMismatches.forEach(mismatch => {
        console.log(`  ❌ Template: ${mismatch.template}`);
        console.log(`     Code expects: ${mismatch.code}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkTemplateTextIssues();
}

