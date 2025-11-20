const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitPlaceholdersComplete() {
  try {
    console.log('Fixing split placeholders (complete version)...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes with their positions
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
    
    // Find and fix split placeholders
    let fixes = [];
    for (let i = 0; i < textNodes.length - 1; i++) {
      const current = textNodes[i];
      const next = textNodes[i + 1];
      
      // Pattern 1: {{# followed by .sensor_base}}
      if (current.text.trim() === '{{#' && next.text.trim() === '.sensor_base}}') {
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>{{#d.hasImages.exterior.sensor_base}}</w:t>`,
          index: current.index
        });
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        console.log(`  Fixing: "{{#" + ".sensor_base}}" -> "{{#d.hasImages.exterior.sensor_base}}"`);
      }
      // Pattern 2: {{# followed by _base}}
      else if (current.text.trim() === '{{#' && next.text.trim() === '_base}}') {
        fixes.push({
          old: current.full,
          new: `<w:t${current.attrs}>{{#d.images.exterior.sensor_base}}</w:t>`,
          index: current.index
        });
        fixes.push({
          old: next.full,
          new: `<w:t${next.attrs}></w:t>`,
          index: next.index
        });
        console.log(`  Fixing: "{{#" + "_base}}" -> "{{#d.images.exterior.sensor_base}}"`);
      }
      // Pattern 3: {{/ followed by }}
      else if (current.text.trim() === '{{/' && next.text.trim() === '}}') {
        // Check previous node to determine which closing tag
        if (i > 0) {
          const prev = textNodes[i - 1];
          // If previous was _base}}, this is images loop close
          if (prev.text === '_base}}' || prev.text.includes('sensor_base')) {
            fixes.push({
              old: current.full,
              new: `<w:t${current.attrs}>{{/d.images.exterior.sensor_base}}</w:t>`,
              index: current.index
            });
            fixes.push({
              old: next.full,
              new: `<w:t${next.attrs}></w:t>`,
              index: next.index
            });
            console.log(`  Fixing: "{{/" + "}}" -> "{{/d.images.exterior.sensor_base}}"`);
          } else {
            // Otherwise it's hasImages close
            fixes.push({
              old: current.full,
              new: `<w:t${current.attrs}>{{/d.hasImages.exterior.sensor_base}}</w:t>`,
              index: current.index
            });
            fixes.push({
              old: next.full,
              new: `<w:t${next.attrs}></w:t>`,
              index: next.index
            });
            console.log(`  Fixing: "{{/" + "}}" -> "{{/d.hasImages.exterior.sensor_base}}"`);
          }
        }
      }
    }
    
    if (fixes.length > 0) {
      // Remove duplicates
      const uniqueFixes = [];
      const seen = new Set();
      
      for (const fix of fixes) {
        const key = `${fix.index}-${fix.old}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFixes.push(fix);
        }
      }
      
      // Sort by index (reverse order)
      uniqueFixes.sort((a, b) => b.index - a.index);
      
      let newXml = xml;
      for (const fix of uniqueFixes) {
        newXml = newXml.replace(fix.old, fix.new);
      }
      
      // Clean up empty text nodes
      newXml = newXml.replace(/<w:t[^>]*><\/w:t>/g, '');
      
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
  fixSplitPlaceholdersComplete();
}

module.exports = { fixSplitPlaceholdersComplete };

