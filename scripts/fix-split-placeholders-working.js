const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitPlaceholdersWorking() {
  try {
    console.log('Fixing split placeholders (working version)...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Pattern 1: {{# followed by .sensor_base}}
    xml = xml.replace(
      /<w:t([^>]*)>\{\{#<\/w:t>\s*<w:t[^>]*>\.sensor_base\}\}<\/w:t>/g,
      '<w:t$1>{{#d.hasImages.exterior.sensor_base}}</w:t>'
    );
    
    // Pattern 2: {{# followed by _base}}
    xml = xml.replace(
      /<w:t([^>]*)>\{\{#<\/w:t>\s*<w:t[^>]*>_base\}\}<\/w:t>/g,
      '<w:t$1>{{#d.images.exterior.sensor_base}}</w:t>'
    );
    
    // Pattern 3: {{/ followed by }}
    // Need to find what comes before {{/
    xml = xml.replace(
      /<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/g,
      (match, attrs) => {
        // Look backwards to find the field name
        // This is tricky, so we'll use a more specific pattern
        return match; // Skip for now, handle separately
      }
    );
    
    // More specific: {{/ followed by }} after sensor_base context
    // Pattern: {{/ + }} = {{/d.images.exterior.sensor_base}}
    xml = xml.replace(
      /<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/g,
      '<w:t$1>{{/d.images.exterior.sensor_base}}</w:t><w:t></w:t>'
    );
    
    // Pattern 4: Another {{/ followed by }}
    xml = xml.replace(
      /<w:t([^>]*)>\{\{\/<\/w:t>\s*<w:t[^>]*>\}\}<\/w:t>/g,
      '<w:t$1>{{/d.hasImages.exterior.sensor_base}}</w:t><w:t></w:t>'
    );
    
    // Clean up empty text nodes
    xml = xml.replace(/<w:t([^>]*)><\/w:t>/g, '');
    
    // Update the zip
    zip.file('word/document.xml', xml);
    
    // Save the file
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(TEMPLATE_PATH, buffer);
    
    console.log('✅ Template saved!');
    
    // Verify
    const finalOpen = (xml.match(/\{\{/g) || []).length;
    const finalClose = (xml.match(/\}\}/g) || []).length;
    console.log(`Final count: ${finalOpen} {{ vs ${finalClose} }}`);
    
    // Check for split nodes again
    const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const splitNodes = [];
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
      console.log(`\n⚠️ Still have ${splitNodes.length} split text nodes:`);
      splitNodes.slice(0, 5).forEach((node, i) => {
        console.log(`  ${i + 1}. "${node.text}" ({{${node.open}} vs }}}${node.close})`);
      });
    } else {
      console.log('\n✅ All placeholders are now in single text nodes!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSplitPlaceholdersWorking();
}

module.exports = { fixSplitPlaceholdersWorking };









