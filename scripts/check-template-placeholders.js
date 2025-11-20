const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function checkTemplatePlaceholders() {
  try {
    console.log('Checking template placeholders...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all placeholder text nodes
    const placeholderPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const placeholders = [];
    let match;
    
    while ((match = placeholderPattern.exec(xml)) !== null) {
      const text = match[1];
      if (text.includes('{{') || text.includes('}}')) {
        placeholders.push(text.trim());
      }
    }
    
    console.log(`\nFound ${placeholders.length} text nodes with placeholders:\n`);
    
    // Group by type
    const simplePlaceholders = placeholders.filter(p => p.match(/^\{\{d\.[^}]+\}\}$/));
    const conditionPlaceholders = placeholders.filter(p => p.match(/^\{\{#d\.[^}]+\}\}$/));
    const closingPlaceholders = placeholders.filter(p => p.match(/^\{\{\/d\.[^}]+\}\}$/));
    const imagePlaceholders = placeholders.filter(p => p.includes('image') || p.includes('signatures'));
    
    console.log(`Simple placeholders ({{d.field}}): ${simplePlaceholders.length}`);
    if (simplePlaceholders.length > 0) {
      console.log('  Samples:');
      simplePlaceholders.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    console.log(`\nCondition placeholders ({{#d.hasImages...}}): ${conditionPlaceholders.length}`);
    if (conditionPlaceholders.length > 0) {
      console.log('  Samples:');
      conditionPlaceholders.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    console.log(`\nClosing placeholders ({{/d...}}): ${closingPlaceholders.length}`);
    if (closingPlaceholders.length > 0) {
      console.log('  Samples:');
      closingPlaceholders.slice(0, 5).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    console.log(`\nImage-related placeholders: ${imagePlaceholders.length}`);
    if (imagePlaceholders.length > 0) {
      console.log('  Samples:');
      imagePlaceholders.slice(0, 10).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    // Check for broken placeholders (just } without {{)
    const brokenPlaceholders = placeholders.filter(p => p.includes('}') && !p.includes('{{'));
    if (brokenPlaceholders.length > 0) {
      console.log(`\n⚠️ WARNING: Found ${brokenPlaceholders.length} potentially broken placeholders (just } without {{):`);
      brokenPlaceholders.slice(0, 10).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    // Check for triple braces
    const tripleBraces = placeholders.filter(p => p.includes('{{{') || p.includes('}}}'));
    if (tripleBraces.length > 0) {
      console.log(`\n⚠️ WARNING: Found ${tripleBraces.length} placeholders with triple braces ({{{ or }}}):`);
      tripleBraces.slice(0, 10).forEach((p, i) => {
        console.log(`    ${i + 1}. ${p}`);
      });
    }
    
    console.log('\n✅ Template placeholder check completed!');
  } catch (error) {
    console.error('Error checking template:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkTemplatePlaceholders();
}

module.exports = { checkTemplatePlaceholders };
