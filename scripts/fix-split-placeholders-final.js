const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitPlaceholdersFinal() {
  try {
    console.log('Fixing split placeholders (final version)...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes
    const textNodePattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    const textNodes = [];
    let match;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      textNodes.push({
        full: match[0],
        attrs: match[1],
        text: match[2],
        index: match.index
      });
    }
    
    console.log(`Found ${textNodes.length} text nodes`);
    
    // Find split placeholders and combine them
    let fixes = [];
    for (let i = 0; i < textNodes.length - 1; i++) {
      const current = textNodes[i];
      const next = textNodes[i + 1];
      
      // Pattern 1: {{# followed by .field}}
      if (current.text === '{{#' && next.text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        const fieldName = next.text;
        const combined = `{{#${fieldName}`;
        
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>${combined}</w:t>`,
          index: current.index
        });
        
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        
        console.log(`  Fixing: "{{#" + "${fieldName}" -> "${combined}"`);
      }
      // Pattern 2: {{/ followed by }}
      else if (current.text === '{{/' && next.text === '}}') {
        // Need to find the field name before this
        if (i > 0) {
          const prev = textNodes[i - 1];
          if (prev.text.match(/^[a-zA-Z0-9_.]+$/)) {
            const fieldName = prev.text;
            const combined = `{{/${fieldName}}}`;
            
            fixes.push({
              old: prev.full,
              new: `<w:t${prev.attrs}></w:t>`,
              index: prev.index
            });
            
            fixes.push({
              old: current.full,
              new: `<w:t${current.attrs}>${combined}</w:t>`,
              index: current.index
            });
            
            fixes.push({
              old: next.full,
              new: `<w:t${next.attrs}></w:t>`,
              index: next.index
            });
            
            console.log(`  Fixing: "${fieldName}" + "{{/" + "}}" -> "${combined}"`);
          }
        }
      }
      // Pattern 3: {{#d.hasImages. followed by field}}
      else if (current.text === '{{#d.hasImages.' && next.text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        const fieldName = next.text;
        const combined = `{{#d.hasImages.${fieldName}`;
        
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>${combined}</w:t>`,
          index: current.index
        });
        
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        
        console.log(`  Fixing: "{{#d.hasImages." + "${fieldName}" -> "${combined}"`);
      }
      // Pattern 4: {{#d.images. followed by field}}
      else if (current.text === '{{#d.images.' && next.text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        const fieldName = next.text;
        const combined = `{{#d.images.${fieldName}`;
        
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>${combined}</w:t>`,
          index: current.index
        });
        
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        
        console.log(`  Fixing: "{{#d.images." + "${fieldName}" -> "${combined}"`);
      }
      // Pattern 5: {{/d.hasImages. followed by field}}
      else if (current.text === '{{/d.hasImages.' && next.text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        const fieldName = next.text;
        const combined = `{{/d.hasImages.${fieldName}`;
        
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>${combined}</w:t>`,
          index: current.index
        });
        
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        
        console.log(`  Fixing: "{{/d.hasImages." + "${fieldName}" -> "${combined}"`);
      }
      // Pattern 6: {{/d.images. followed by field}}
      else if (current.text === '{{/d.images.' && next.text.match(/^[a-zA-Z0-9_.]+}}$/)) {
        const fieldName = next.text;
        const combined = `{{/d.images.${fieldName}`;
        
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>${combined}</w:t>`,
          index: current.index
        });
        
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        
        console.log(`  Fixing: "{{/d.images." + "${fieldName}" -> "${combined}"`);
      }
    }
    
    if (fixes.length > 0) {
      // Remove duplicates and sort by index (reverse)
      const uniqueFixes = [];
      const seen = new Set();
      
      for (const fix of fixes) {
        const key = `${fix.index}-${fix.old}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFixes.push(fix);
        }
      }
      
      uniqueFixes.sort((a, b) => b.index - a.index);
      
      let newXml = xml;
      for (const fix of uniqueFixes) {
        newXml = newXml.replace(fix.old, fix.new);
      }
      
      // Update the zip
      zip.file('word/document.xml', newXml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`\n✅ Applied ${uniqueFixes.length} fixes and saved template!`);
      
      // Verify
      const finalOpen = (newXml.match(/\{\{/g) || []).length;
      const finalClose = (newXml.match(/\}\}/g) || []).length;
      console.log(`Final count: ${finalOpen} {{ vs ${finalClose} }}`);
      
    } else {
      console.log('⚠️ No split placeholders found to fix');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  fixSplitPlaceholdersFinal();
}

module.exports = { fixSplitPlaceholdersFinal };









