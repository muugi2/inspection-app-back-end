const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitRuns() {
  try {
    console.log('Fixing split placeholders across runs...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const before = xml;
    let fixes = 0;
    
    // Pattern 1: {{#</w:t></w:r>...<w:r>...<w:t>.sensor_base}}</w:t>
    // This is split across multiple runs
    xml = xml.replace(
      /<w:t([^>]*)>\{\{#<\/w:t><\/w:r>[\s\S]*?<w:r[^>]*>[\s\S]*?<w:t[^>]*>\.sensor_base\}\}<\/w:t>/g,
      (match) => {
        fixes++;
        // Extract attributes from first w:t
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{#d.hasImages.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Pattern 2: {{#</w:t></w:r>...<w:r>...<w:t>_base}}</w:t>
    xml = xml.replace(
      /<w:t([^>]*)>\{\{#<\/w:t><\/w:r>[\s\S]*?<w:r[^>]*>[\s\S]*?<w:t[^>]*>_base\}\}<\/w:t>/g,
      (match) => {
        fixes++;
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{#d.images.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Pattern 3: {{/</w:t></w:r>...<w:r>...<w:t>}}</w:t> (first - images close)
    let closeCount = 0;
    xml = xml.replace(
      /<w:t([^>]*)>\{\{\/<\/w:t><\/w:r>[\s\S]*?<w:r[^>]*>[\s\S]*?<w:t[^>]*>\}\}<\/w:t>/g,
      (match) => {
        closeCount++;
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        if (closeCount === 1) {
          fixes++;
          return `<w:t${attrs}>{{/d.images.exterior.sensor_base}}</w:t>`;
        } else if (closeCount === 2) {
          fixes++;
          return `<w:t${attrs}>{{/d.hasImages.exterior.sensor_base}}</w:t>`;
        }
        return match;
      }
    );
    
    // Clean up empty runs
    xml = xml.replace(/<w:r[^>]*><\/w:r>/g, '');
    xml = xml.replace(/<w:t[^>]*><\/w:t>/g, '');
    
    if (xml !== before) {
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`✅ Applied ${fixes} fixes and saved template!`);
      
      // Verify
      const finalOpen = (xml.match(/\{\{/g) || []).length;
      const finalClose = (xml.match(/\}\}/g) || []).length;
      console.log(`Final count: ${finalOpen} {{ vs ${finalClose} }}`);
      
    } else {
      console.log('⚠️ No changes made');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSplitRuns();
}

module.exports = { fixSplitRuns };







