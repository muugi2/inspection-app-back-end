const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function debugSplitPlaceholders() {
  try {
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes with {{ or }}
    const textNodePattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    const problematicNodes = [];
    let match;
    let index = 0;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      const text = match[2];
      if (text.includes('{{') || text.includes('}}')) {
        problematicNodes.push({
          index: index++,
          text: text,
          open: (text.match(/\{\{/g) || []).length,
          close: (text.match(/\}\}/g) || []).length
        });
      }
    }
    
    console.log('Problematic text nodes:');
    problematicNodes.forEach((node, i) => {
      if (node.open !== node.close) {
        console.log(`\n${i + 1}. Index: ${node.index}, Open: ${node.open}, Close: ${node.close}`);
        console.log(`   Text: "${node.text}"`);
        
        // Find adjacent nodes
        if (i > 0) {
          const prev = problematicNodes[i - 1];
          console.log(`   Previous: "${prev.text}"`);
        }
        if (i < problematicNodes.length - 1) {
          const next = problematicNodes[i + 1];
          console.log(`   Next: "${next.text}"`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  debugSplitPlaceholders();
}

module.exports = { debugSplitPlaceholders };









