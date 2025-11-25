const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitPlaceholders() {
  try {
    console.log('Fixing split placeholders in template...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes and check for split placeholders
    const textNodePattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    const textNodes = [];
    let match;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      const fullMatch = match[0];
      const attrs = match[1];
      const text = match[2];
      
      // Check if this text node has incomplete placeholder
      if (text.includes('{{') && !text.includes('}}')) {
        textNodes.push({
          full: fullMatch,
          attrs: attrs,
          text: text,
          index: match.index
        });
      } else if (text.includes('}}') && !text.includes('{{')) {
        textNodes.push({
          full: fullMatch,
          attrs: attrs,
          text: text,
          index: match.index,
          isClose: true
        });
      }
    }
    
    console.log(`Found ${textNodes.length} potentially split text nodes`);
    
    // Try to combine split placeholders
    // Look for patterns like "{{#" followed by ".sensor_base}}"
    let fixes = 0;
    
    // Pattern 1: {{# followed by .field}}
    xml = xml.replace(/<w:t([^>]*)>\{\{#<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      // Check if the second part looks like a field name
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{#${text}</w:t>`;
      }
      return match;
    });
    
    // Pattern 2: {{/ followed by }}
    xml = xml.replace(/<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{/${text}</w:t>`;
      }
      return match;
    });
    
    // Pattern 3: {{#d.hasImages. followed by field}}
    xml = xml.replace(/<w:t([^>]*)>\{\{#d\.hasImages\.<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{#d.hasImages.${text}</w:t>`;
      }
      return match;
    });
    
    // Pattern 4: {{#d.images. followed by field}}
    xml = xml.replace(/<w:t([^>]*)>\{\{#d\.images\.<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{#d.images.${text}</w:t>`;
      }
      return match;
    });
    
    // Pattern 5: {{/d.hasImages. followed by field}}
    xml = xml.replace(/<w:t([^>]*)>\{\{\/d\.hasImages\.<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{/d.hasImages.${text}</w:t>`;
      }
      return match;
    });
    
    // Pattern 6: {{/d.images. followed by field}}
    xml = xml.replace(/<w:t([^>]*)>\{\{\/d\.images\.<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{/d.images.${text}</w:t>`;
      }
      return match;
    });
    
    // More general pattern: {{# followed by anything ending with }}
    xml = xml.replace(/<w:t([^>]*)>\{\{#<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{#${text}</w:t>`;
      }
      return match;
    });
    
    // More general pattern: {{/ followed by anything ending with }}
    xml = xml.replace(/<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>([^<]+)<\/w:t>/g, (match, attrs, text) => {
      if (text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        fixes++;
        return `<w:t${attrs}>{{/${text}</w:t>`;
      }
      return match;
    });
    
    console.log(`Applied ${fixes} fixes`);
    
    if (fixes > 0) {
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log('✅ Template saved!');
      
      // Verify
      const finalOpen = (xml.match(/\{\{/g) || []).length;
      const finalClose = (xml.match(/\}\}/g) || []).length;
      console.log(`\nFinal count: ${finalOpen} {{ vs ${finalClose} }}`);
      
      // Check for split placeholders again
      const splitNodes = [];
      const checkPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let checkMatch;
      
      while ((checkMatch = checkPattern.exec(xml)) !== null) {
        const text = checkMatch[1];
        const openCount = (text.match(/\{\{/g) || []).length;
        const closeCount = (text.match(/\}\}/g) || []).length;
        
        if (openCount !== closeCount) {
          splitNodes.push({ text: text.substring(0, 50), open: openCount, close: closeCount });
        }
      }
      
      if (splitNodes.length > 0) {
        console.log(`\n⚠️ Still have ${splitNodes.length} split text nodes:`);
        splitNodes.slice(0, 5).forEach((node, i) => {
          console.log(`  ${i + 1}. "${node.text}" ({{${node.open}} vs }}}${node.close})`);
        });
      } else {
        console.log('\n✅ All placeholders are now in single text nodes!');
      }
    } else {
      console.log('⚠️ No fixes applied. Placeholders might need manual fixing.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSplitPlaceholders();
}

module.exports = { fixSplitPlaceholders };









