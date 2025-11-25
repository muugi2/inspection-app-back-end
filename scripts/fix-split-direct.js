const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitDirect() {
  try {
    console.log('Fixing split placeholders directly...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const originalXml = xml;
    let fixes = 0;
    
    // Direct string replacements for known split patterns
    // Pattern 1: {{# + .sensor_base}}
    if (xml.includes('{{#') && xml.includes('.sensor_base}}')) {
      // Find the exact pattern across text nodes
      xml = xml.replace(
        /<w:t[^>]*>\{\{#<\/w:t>\s*<w:t[^>]*>\.sensor_base\}\}<\/w:t>/g,
        '<w:t>{{#d.hasImages.exterior.sensor_base}}</w:t>'
      );
      fixes++;
      console.log('  Fixed: {{# + .sensor_base}}');
    }
    
    // Pattern 2: {{# + _base}}
    if (xml.includes('{{#') && xml.includes('_base}}')) {
      xml = xml.replace(
        /<w:t[^>]*>\{\{#<\/w:t>\s*<w:t[^>]*>_base\}\}<\/w:t>/g,
        '<w:t>{{#d.images.exterior.sensor_base}}</w:t>'
      );
      fixes++;
      console.log('  Fixed: {{# + _base}}');
    }
    
    // Pattern 3: {{/ + }} (first - images close)
    // Look for context: after _base}}
    const imagesClosePattern = /_base\}\}<\/w:t>[\s\S]{0,500}<w:t[^>]*>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/;
    if (imagesClosePattern.test(xml)) {
      xml = xml.replace(
        /_base\}\}<\/w:t>([\s\S]{0,500})<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/,
        (match, between, attrs) => {
          // Only replace the first occurrence
          if (!match.includes('{{/d.images.exterior.sensor_base}}')) {
            return `_base}}</w:t>${between}<w:t${attrs}>{{/d.images.exterior.sensor_base}}</w:t>`;
          }
          return match;
        }
      );
      fixes++;
      console.log('  Fixed: {{/ + }} (images close)');
    }
    
    // Pattern 4: {{/ + }} (second - hasImages close)
    // Look for context: after sensor_base}}
    const hasImagesClosePattern = /sensor_base\}\}<\/w:t>[\s\S]{0,500}<w:t[^>]*>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/;
    if (hasImagesClosePattern.test(xml)) {
      xml = xml.replace(
        /sensor_base\}\}<\/w:t>([\s\S]{0,500})<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/,
        (match, between, attrs) => {
          // Only replace if not already fixed
          if (!match.includes('{{/d.hasImages.exterior.sensor_base}}') && 
              !match.includes('{{/d.images.exterior.sensor_base}}')) {
            return `sensor_base}}</w:t>${between}<w:t${attrs}>{{/d.hasImages.exterior.sensor_base}}</w:t>`;
          }
          return match;
        }
      );
      fixes++;
      console.log('  Fixed: {{/ + }} (hasImages close)');
    }
    
    // Clean up empty text nodes
    xml = xml.replace(/<w:t[^>]*><\/w:t>/g, '');
    
    if (xml !== originalXml) {
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`\n✅ Applied ${fixes} fixes and saved template!`);
      
      // Verify
      const finalOpen = (xml.match(/\{\{/g) || []).length;
      const finalClose = (xml.match(/\}\}/g) || []).length;
      console.log(`Final count: ${finalOpen} {{ vs ${finalClose} }}`);
      
      // Check for split nodes
      const splitNodes = [];
      const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let checkMatch;
      
      while ((checkMatch = textNodePattern.exec(xml)) !== null) {
        const text = checkMatch[1];
        const openCount = (text.match(/\{\{/g) || []).length;
        const closeCount = (text.match(/\}\}/g) || []).length;
        
        if (openCount !== closeCount) {
          splitNodes.push({ text: text.substring(0, 50), open: openCount, close: closeCount });
        }
      }
      
      if (splitNodes.length > 0) {
        console.log(`\n⚠️ Still have ${splitNodes.length} split text nodes`);
      } else {
        console.log('\n✅ All placeholders fixed!');
      }
      
    } else {
      console.log('⚠️ No changes made');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSplitDirect();
}

module.exports = { fixSplitDirect };









