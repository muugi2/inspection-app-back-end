const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSensorBaseComplete() {
  try {
    console.log('Fixing sensor_base placeholders completely...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const originalXml = xml;
    let fixes = 0;
    
    // Find the sensor_base section and fix all placeholders
    // We need to ensure all placeholders are in single text nodes
    
    // Pattern 1: Fix {{#d.hasImages.exterior.sensor_base}} if split
    // Look for patterns like: <w:t>{</w:t><w:t>{</w:t><w:t>#d.hasImages...</w:t>
    xml = xml.replace(
      /<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>#d\.hasImages\.exterior\.sensor_base\}<\/w:t>\s*<w:t[^>]*>\}<\/w:t>/g,
      (match) => {
        fixes++;
        // Extract first w:t attributes
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{#d.hasImages.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Pattern 2: Fix {{#d.images.exterior.sensor_base}} if split
    xml = xml.replace(
      /<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>#d\.images\.exterior\.sensor_base\}<\/w:t>\s*<w:t[^>]*>\}<\/w:t>/g,
      (match) => {
        fixes++;
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{#d.images.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Pattern 3: Fix {{/d.images.exterior.sensor_base}} if split
    xml = xml.replace(
      /<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\/d\.images\.exterior\.sensor_base\}<\/w:t>\s*<w:t[^>]*>\}<\/w:t>/g,
      (match) => {
        fixes++;
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{/d.images.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Pattern 4: Fix {{/d.hasImages.exterior.sensor_base}} if split
    xml = xml.replace(
      /<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\{<\/w:t>\s*<w:t[^>]*>\/d\.hasImages\.exterior\.sensor_base\}<\/w:t>\s*<w:t[^>]*>\}<\/w:t>/g,
      (match) => {
        fixes++;
        const attrsMatch = match.match(/<w:t([^>]*)>/);
        const attrs = attrsMatch ? attrsMatch[1] : '';
        return `<w:t${attrs}>{{/d.hasImages.exterior.sensor_base}}</w:t>`;
      }
    );
    
    // Also check for placeholders that might be in separate runs but not split
    // Sometimes Word splits them across runs even if they look complete
    
    // More aggressive: Find any placeholder that contains sensor_base and ensure it's in one text node
    const sensorBasePlaceholders = [
      '{{#d.hasImages.exterior.sensor_base}}',
      '{{#d.images.exterior.sensor_base}}',
      '{{/d.images.exterior.sensor_base}}',
      '{{/d.hasImages.exterior.sensor_base}}'
    ];
    
    // Check if any of these are split across multiple text nodes
    for (const placeholder of sensorBasePlaceholders) {
      // Find all occurrences
      let searchIndex = 0;
      while ((searchIndex = xml.indexOf(placeholder, searchIndex)) !== -1) {
        // Check if this placeholder is split across runs
        const before = xml.substring(Math.max(0, searchIndex - 200), searchIndex);
        const after = xml.substring(searchIndex, Math.min(xml.length, searchIndex + placeholder.length + 200));
        
        // If we see the placeholder but it's not in a single <w:t> node, we need to fix it
        // Check if there are multiple <w:t> nodes between the start and end
        const textNodesBetween = (before + after).match(/<w:t[^>]*>/g);
        if (textNodesBetween && textNodesBetween.length > 1) {
          // The placeholder might be split - let's reconstruct it
          const placeholderStart = before.lastIndexOf('<w:t');
          const placeholderEnd = after.indexOf('</w:t>') + placeholder.length;
          
          if (placeholderStart >= 0 && placeholderEnd > 0) {
            // Extract the full run structure
            const runStart = before.lastIndexOf('<w:r');
            const runEnd = after.indexOf('</w:r>') + 6;
            
            if (runStart >= 0 && runEnd > 0) {
              const fullRun = (before.substring(runStart) + after.substring(0, runEnd));
              
              // Check if placeholder is split
              if (fullRun.includes('{{') && fullRun.includes('}}') && 
                  !fullRun.includes(placeholder)) {
                // It's split - we need to combine it
                const attrsMatch = fullRun.match(/<w:t([^>]*)>/);
                const attrs = attrsMatch ? attrsMatch[1] : '';
                
                // Replace the entire run with a single text node containing the placeholder
                const newRun = fullRun.replace(
                  /<w:r[^>]*>[\s\S]*?<\/w:r>/,
                  `<w:r${fullRun.match(/<w:r([^>]*)>/)?.[1] || ''}><w:t${attrs}>${placeholder}</w:t></w:r>`
                );
                
                xml = xml.substring(0, runStart) + newRun + xml.substring(runStart + fullRun.length);
                fixes++;
                console.log(`  Fixed split placeholder: ${placeholder}`);
              }
            }
          }
        }
        
        searchIndex += placeholder.length;
      }
    }
    
    // Clean up empty runs and text nodes
    xml = xml.replace(/<w:r[^>]*><\/w:r>/g, '');
    xml = xml.replace(/<w:t[^>]*><\/w:t>/g, '');
    
    if (xml !== originalXml) {
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
      
      // Check if placeholders are now complete
      console.log('\nVerifying placeholders:');
      sensorBasePlaceholders.forEach(placeholder => {
        const found = xml.includes(placeholder);
        console.log(`  ${found ? '✅' : '❌'} ${placeholder}`);
      });
      
    } else {
      console.log('⚠️ No changes made - placeholders might already be correct');
      console.log('But easy-template-x still can\'t parse them. Checking structure...');
      
      // Check the actual structure around sensor_base
      const sensorBaseIndex = xml.indexOf('{{#d.hasImages.exterior.sensor_base}}');
      if (sensorBaseIndex >= 0) {
        const context = xml.substring(Math.max(0, sensorBaseIndex - 100), 
                                     Math.min(xml.length, sensorBaseIndex + 200));
        console.log('\nStructure around sensor_base:');
        console.log(context);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSensorBaseComplete();
}

module.exports = { fixSensorBaseComplete };







