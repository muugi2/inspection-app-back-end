const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixAllPlaceholdersAggressive() {
  try {
    console.log('Aggressively fixing all placeholders...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const originalXml = xml;
    let fixes = 0;
    
    // Strategy: Find all placeholder patterns and ensure they're in single text nodes
    // We'll use a more aggressive approach: find all {{...}} patterns and ensure they're complete
    
    // First, let's find all placeholders
    const placeholderPattern = /\{\{[^}]+\}\}/g;
    const placeholders = [];
    let match;
    
    while ((match = placeholderPattern.exec(xml)) !== null) {
      placeholders.push({
        text: match[0],
        index: match.index,
        full: match[0]
      });
    }
    
    console.log(`Found ${placeholders.length} placeholders\n`);
    
    // Now, for each placeholder, check if it's split across multiple text nodes
    // If it is, combine them into a single text node
    
    // We'll work backwards to avoid index shifting
    for (let i = placeholders.length - 1; i >= 0; i--) {
      const placeholder = placeholders[i];
      const startIndex = placeholder.index;
      const endIndex = startIndex + placeholder.text.length;
      
      // Find the text nodes that contain this placeholder
      // Look for <w:t> nodes that might contain parts of this placeholder
      const beforeContext = xml.substring(Math.max(0, startIndex - 500), startIndex);
      const afterContext = xml.substring(endIndex, Math.min(xml.length, endIndex + 500));
      const fullContext = beforeContext + placeholder.text + afterContext;
      
      // Check if the placeholder is split across multiple <w:t> nodes
      // Find all <w:t> nodes in the context
      const textNodeMatches = [...fullContext.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
      
      // Check if any text node contains only part of the placeholder
      let isSplit = false;
      let combinedText = '';
      let firstAttrs = '';
      
      for (const textMatch of textNodeMatches) {
        const text = textMatch[1];
        if (text.includes('{{') || text.includes('}}')) {
          combinedText += text;
          if (!firstAttrs) {
            firstAttrs = textMatch[0].match(/<w:t([^>]*)>/)?.[1] || '';
          }
          // Check if this is a partial placeholder
          if ((text.includes('{{') && !text.includes('}}')) || 
              (text.includes('}}') && !text.includes('{{'))) {
            isSplit = true;
          }
        }
      }
      
      // If the placeholder is split, we need to fix it
      if (isSplit || combinedText !== placeholder.text) {
        // Find the run structure that contains this placeholder
        const runStart = beforeContext.lastIndexOf('<w:r');
        const runEnd = afterContext.indexOf('</w:r>');
        
        if (runStart >= 0) {
          // Extract the full run structure
          const runContextStart = Math.max(0, startIndex - 500 + runStart);
          const runContextEnd = Math.min(xml.length, endIndex + 500);
          const runContext = xml.substring(runContextStart, runContextEnd);
          
          // Find the complete run
          const runMatch = runContext.match(/<w:r[^>]*>[\s\S]*?<\/w:r>/);
          if (runMatch) {
            const fullRun = runMatch[0];
            const runAttrs = fullRun.match(/<w:r([^>]*)>/)?.[1] || '';
            
            // Replace the entire run with a single text node containing the placeholder
            const newRun = `<w:r${runAttrs}><w:t${firstAttrs || ''}>${placeholder.text}</w:t></w:r>`;
            
            xml = xml.substring(0, runContextStart + runMatch.index) + 
                  newRun + 
                  xml.substring(runContextStart + runMatch.index + fullRun.length);
            
            fixes++;
            console.log(`  Fixed: ${placeholder.text.substring(0, 50)}...`);
          }
        }
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
      
      console.log(`\n✅ Applied ${fixes} fixes and saved template!`);
      
      // Verify
      const finalOpen = (xml.match(/\{\{/g) || []).length;
      const finalClose = (xml.match(/\}\}/g) || []).length;
      console.log(`Final count: ${finalOpen} {{ vs ${finalClose} }}`);
      
    } else {
      console.log('⚠️ No changes made');
      console.log('\nTrying alternative approach: checking for placeholder structure issues...');
      
      // Alternative: Maybe the issue is that placeholders are in the wrong XML structure
      // Let's check if there are any XML entities or special characters
      const sensorBasePlaceholder = '{{#d.hasImages.exterior.sensor_base}}';
      const index = xml.indexOf(sensorBasePlaceholder);
      if (index >= 0) {
        const context = xml.substring(Math.max(0, index - 200), Math.min(xml.length, index + 300));
        console.log('\nFull XML structure around first placeholder:');
        console.log(context);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixAllPlaceholdersAggressive();
}

module.exports = { fixAllPlaceholdersAggressive };




