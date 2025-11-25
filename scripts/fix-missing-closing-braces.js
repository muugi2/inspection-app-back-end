const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixMissingClosingBraces() {
  try {
    console.log('Fixing missing closing braces in template...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes with {{ but no matching }}
    const textNodePattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    let replacements = [];
    let match;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      const fullMatch = match[0];
      const attrs = match[1];
      const text = match[2];
      
      // Check if text has {{ but no matching }}
      const openCount = (text.match(/\{\{/g) || []).length;
      const closeCount = (text.match(/\}\}/g) || []).length;
      
      if (openCount > closeCount) {
        // Find placeholders that start with {{ but don't have }}
        // Pattern: {{ followed by text that doesn't contain }}
        let fixedText = text;
        
        // Fix patterns like {{d.contractor.company -> {{d.contractor.company}}
        // This handles cases where the placeholder is incomplete
        fixedText = fixedText.replace(/\{\{([^}]+?)(?:\}\}|$)/g, (match, content) => {
          // If it doesn't end with }}, add it
          if (!match.endsWith('}}')) {
            return `{{${content}}}`;
          }
          return match;
        });
        
        // Also handle cases where we have {{d.xxx without any closing
        fixedText = fixedText.replace(/\{\{([^}]+)$/g, '{{$1}}');
        
        if (fixedText !== text) {
          const fixedFull = `<w:t${attrs}>${fixedText}</w:t>`;
          replacements.push({ original: fullMatch, fixed: fixedFull });
          console.log(`  Fixing: "${text.substring(0, 50)}" -> "${fixedText.substring(0, 50)}"`);
        }
      }
    }
    
    // Apply replacements
    if (replacements.length > 0) {
      console.log(`\nApplying ${replacements.length} fixes...`);
      replacements.forEach(replacement => {
        xml = xml.replace(replacement.original, replacement.fixed);
      });
      
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`✅ Fixed ${replacements.length} placeholders`);
      
      // Verify
      const finalOpenCount = (xml.match(/\{\{/g) || []).length;
      const finalCloseCount = (xml.match(/\}\}/g) || []).length;
      console.log(`\nFinal count: ${finalOpenCount} {{ vs ${finalCloseCount} }}`);
      
      if (finalOpenCount === finalCloseCount) {
        console.log('✅ All placeholders are now balanced!');
      } else {
        console.warn(`⚠️ Still unmatched: ${finalOpenCount - finalCloseCount} difference`);
      }
    } else {
      console.log('✅ No fixes needed - all placeholders are complete');
    }
    
  } catch (error) {
    console.error('Error fixing template:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  fixMissingClosingBraces();
}

module.exports = { fixMissingClosingBraces };









