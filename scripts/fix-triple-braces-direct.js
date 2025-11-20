const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');
const OUTPUT_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function fixTripleBraces() {
  try {
    console.log('Loading template...');
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    
    console.log('Reading document.xml...');
    const xml = await zip.file('word/document.xml').async('string');
    
    // Count triple braces before
    const tripleOpenBefore = (xml.match(/\{\{\{/g) || []).length;
    const tripleCloseBefore = (xml.match(/\}\}\}/g) || []).length;
    
    console.log(`Found ${tripleOpenBefore} {{{ and ${tripleCloseBefore} }}}`);
    
    // Fix triple braces - do multiple passes to handle nested cases
    let fixedXml = xml;
    let previousXml = '';
    let passCount = 0;
    
    while (fixedXml !== previousXml && passCount < 10) {
      previousXml = fixedXml;
      passCount++;
      fixedXml = fixedXml.replace(/\{\{\{/g, '{{');
      fixedXml = fixedXml.replace(/\}\}\}/g, '}}');
    }
    
    // Also fix in text nodes specifically
    fixedXml = fixedXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, text) => {
      let fixedText = text;
      let prevText = '';
      let textPassCount = 0;
      while (fixedText !== prevText && textPassCount < 10) {
        prevText = fixedText;
        textPassCount++;
        fixedText = fixedText.replace(/\{\{\{/g, '{{');
        fixedText = fixedText.replace(/\}\}\}/g, '}}');
      }
      return `<w:t${attrs}>${fixedText}</w:t>`;
    });
    
    // Count after
    const tripleOpenAfter = (fixedXml.match(/\{\{\{/g) || []).length;
    const tripleCloseAfter = (fixedXml.match(/\}\}\}/g) || []).length;
    const doubleOpenAfter = (fixedXml.match(/\{\{/g) || []).length;
    const doubleCloseAfter = (fixedXml.match(/\}\}/g) || []).length;
    
    console.log(`After fixing: ${tripleOpenAfter} {{{ and ${tripleCloseAfter} }}}`);
    console.log(`After fixing: ${doubleOpenAfter} {{ and ${doubleCloseAfter} }}`);
    
    if (tripleOpenAfter > 0 || tripleCloseAfter > 0) {
      console.warn(`⚠️ WARNING: Still found ${tripleOpenAfter} {{{ and ${tripleCloseAfter} }}}`);
      console.warn('  Template may need manual fixing in Word');
    } else {
      console.log('✅ All triple braces fixed!');
    }
    
    // Update the XML in the zip
    zip.file('word/document.xml', fixedXml);
    
    // Save the DOCX
    console.log('Saving fixed template...');
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      },
    });
    
    fs.writeFileSync(OUTPUT_PATH, buffer);
    console.log(`✅ Template saved: ${OUTPUT_PATH}`);
    
  } catch (error) {
    console.error('Error fixing triple braces:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  fixTripleBraces();
}

module.exports = { fixTripleBraces };









