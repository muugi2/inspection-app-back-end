const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function findBrokenPlaceholders() {
  try {
    console.log('Checking template for broken placeholders...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all {{ without matching }}
    const openDelimiters = [...xml.matchAll(/\{\{/g)];
    const closeDelimiters = [...xml.matchAll(/\}\}/g)];
    
    console.log(`\nFound ${openDelimiters.length} opening delimiters {{`);
    console.log(`Found ${closeDelimiters.length} closing delimiters }}`);
    
    if (openDelimiters.length !== closeDelimiters.length) {
      console.error(`\n❌ ERROR: Unmatched delimiters!`);
      
    // Find lines with broken placeholders
    const lines = xml.split('\n');
    const brokenLines = [];
    lines.forEach((line, index) => {
      const openCount = (line.match(/\{\{/g) || []).length;
      const closeCount = (line.match(/\}\}/g) || []).length;
      
      if (openCount !== closeCount) {
        const preview = line.trim().substring(0, 150);
        if (preview.length > 0) {
          brokenLines.push({
            line: index + 1,
            open: openCount,
            close: closeCount,
            diff: openCount - closeCount,
            text: preview,
          });
        }
      }
    });
    
    if (brokenLines.length > 0) {
      console.log(`\nFound ${brokenLines.length} broken lines:`);
      brokenLines.slice(0, 10).forEach(b => {
        console.log(`\nLine ${b.line} ({{${b.open}} vs }}}${b.close}, diff: ${b.diff > 0 ? '+' : ''}${b.diff}):`);
        console.log(`  ${b.text}`);
      });
      
      // Try to find the actual broken placeholder in text nodes
      const textNodes = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
      let brokenTextNodes = [];
      
      textNodes.forEach((match, index) => {
        const text = match[1];
        const openCount = (text.match(/\{\{/g) || []).length;
        const closeCount = (text.match(/\}\}/g) || []).length;
        
        if (openCount !== closeCount) {
          brokenTextNodes.push({
            text,
            openCount,
            closeCount,
            index: index + 1,
          });
        }
      });
      
      if (brokenTextNodes.length > 0) {
        console.log(`\n\nBroken text nodes found: ${brokenTextNodes.length}`);
        brokenTextNodes.slice(0, 5).forEach(node => {
          console.log(`\nText node ${node.index} ({{${node.openCount}} vs }}}${node.closeCount}):`);
          console.log(`  "${node.text}"`);
        });
      }
    }
      
      // Find specific broken patterns
      const brokenPatterns = [
        /\{\{[^}]*$/g,  // {{ without }}
        /\{\{[^}]*\n/g,  // {{ with newline before }}
        /[^{]\{\{[^}]*$/g,  // {{ at end of line
      ];
      
      brokenPatterns.forEach((pattern, index) => {
        const matches = [...xml.matchAll(pattern)];
        if (matches.length > 0) {
          console.log(`\nBroken pattern ${index + 1} found ${matches.length} times:`);
          matches.slice(0, 5).forEach(match => {
            const context = match[0].substring(0, 50);
            console.log(`  - ${context}...`);
          });
        }
      });
    } else {
      console.log('\n✅ All delimiters matched!');
    }
    
    // Check for placeholder structure
    const allPlaceholders = [...xml.matchAll(/\{\{[^}]+\}\}/g)];
    console.log(`\nValid placeholders found: ${allPlaceholders.length}`);
    
    // Check for condition/loop placeholders
    const conditions = [...xml.matchAll(/\{\{#d\.hasImages[^\}]+\}\}/g)];
    const loops = [...xml.matchAll(/\{\{#d\.images[^\}]+\}\}/g)];
    const closings = [...xml.matchAll(/\{\{\/d\.(images|hasImages)[^\}]+\}\}/g)];
    
    console.log(`\nCondition placeholders: ${conditions.length}`);
    console.log(`Loop placeholders: ${loops.length}`);
    console.log(`Closing placeholders: ${closings.length}`);
    
    if (conditions.length !== closings.filter(c => c[1] === 'hasImages').length) {
      console.warn(`\n⚠️ WARNING: Condition placeholders don't match closings!`);
    }
    
    if (loops.length !== closings.filter(c => c[1] === 'images').length) {
      console.warn(`\n⚠️ WARNING: Loop placeholders don't match closings!`);
    }
    
  } catch (error) {
    console.error('Error checking template:', error.message);
  }
}

if (require.main === module) {
  findBrokenPlaceholders();
}

module.exports = { findBrokenPlaceholders };

