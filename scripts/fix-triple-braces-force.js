const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixTripleBracesForce() {
  try {
    console.log('Force fixing triple braces in template...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const beforeOpen = (xml.match(/\{\{\{/g) || []).length;
    const beforeClose = (xml.match(/\}\}\}/g) || []).length;
    
    console.log(`Before: ${beforeOpen} {{{ and ${beforeClose} }}}`);
    
    // Force replace triple braces with double braces
    // Do multiple passes to handle nested cases
    let previousXml = '';
    let iterations = 0;
    while (xml !== previousXml && iterations < 10) {
      previousXml = xml;
      iterations++;
      
      // Replace {{{ with {{
      xml = xml.replace(/\{\{\{/g, '{{');
      // Replace }}} with }}
      xml = xml.replace(/\}\}\}/g, '}}');
    }
    
    // Also fix in text nodes specifically
    xml = xml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, text) => {
      let fixedText = text;
      let prevText = '';
      let textIterations = 0;
      
      while (fixedText !== prevText && textIterations < 10) {
        prevText = fixedText;
        textIterations++;
        fixedText = fixedText.replace(/\{\{\{/g, '{{');
        fixedText = fixedText.replace(/\}\}\}/g, '}}');
      }
      
      return `<w:t${attrs}>${fixedText}</w:t>`;
    });
    
    const afterOpen = (xml.match(/\{\{\{/g) || []).length;
    const afterClose = (xml.match(/\}\}\}/g) || []).length;
    const doubleOpen = (xml.match(/\{\{/g) || []).length;
    const doubleClose = (xml.match(/\}\}/g) || []).length;
    
    console.log(`After: ${afterOpen} {{{ and ${afterClose} }}}`);
    console.log(`Double braces: ${doubleOpen} {{ and ${doubleClose} }}`);
    
    if (afterOpen === 0 && afterClose === 0) {
      console.log('✅ All triple braces fixed!');
      
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log('✅ Template saved!');
      
      // Verify placeholders
      const placeholders = [...xml.matchAll(/\{\{([^}]+)\}\}/g)];
      console.log(`\nValid placeholders found: ${placeholders.length}`);
      if (placeholders.length > 0) {
        console.log('Sample placeholders:');
        placeholders.slice(0, 5).forEach(p => {
          console.log(`  {{${p[1]}}}`);
        });
      }
    } else {
      console.warn(`⚠️ Still have ${afterOpen} {{{ and ${afterClose} }}}`);
      console.warn('   Template may need manual fixing');
    }
    
  } catch (error) {
    console.error('Error fixing template:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  fixTripleBracesForce();
}

module.exports = { fixTripleBracesForce };









