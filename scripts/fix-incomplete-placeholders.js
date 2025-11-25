const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixIncompletePlaceholders() {
  try {
    console.log('Fixing incomplete placeholders in template...');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // First, let's see what we have
    const openMatches = [...xml.matchAll(/\{\{/g)];
    const closeMatches = [...xml.matchAll(/\}\}/g)];
    
    console.log(`Found ${openMatches.length} {{ and ${closeMatches.length} }}`);
    
    // Find patterns like {{d.xxx that don't have closing }}
    // We need to look across text nodes since Word splits them
    const textNodes = [...xml.matchAll(/<w:t([^>]*)>([^<]*)<\/w:t>/g)];
    
    console.log(`\nChecking ${textNodes.length} text nodes...`);
    
    let fixes = [];
    let currentRun = null;
    let runText = '';
    let runStartIndex = -1;
    
    // Process runs (w:r elements) which contain text nodes
    const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let runMatch;
    
    while ((runMatch = runPattern.exec(xml)) !== null) {
      const runXml = runMatch[0];
      const runContent = runMatch[1];
      
      // Extract all text from this run
      const textMatches = [...runContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
      const runText = textMatches.map(m => m[1]).join('');
      
      if (runText.includes('{{')) {
        // Check if this run has incomplete placeholders
        const openInRun = (runText.match(/\{\{/g) || []).length;
        const closeInRun = (runText.match(/\}\}/g) || []).length;
        
        if (openInRun > closeInRun) {
          // This run has incomplete placeholders
          // Fix: add }} to incomplete placeholders
          let fixedRunText = runText;
          
          // Find all {{ that don't have matching }}
          // Pattern: {{ followed by text, but no }} before next {{ or end
          fixedRunText = fixedRunText.replace(/\{\{([^}]+?)(?=\{\{|$)/g, (match, content) => {
            // If this doesn't end with }}, we need to add it
            // But first check if the next part has }}
            const nextPart = fixedRunText.substring(fixedRunText.indexOf(match) + match.length);
            if (!nextPart.startsWith('}}') && !match.endsWith('}}')) {
              return `{{${content}}}`;
            }
            return match;
          });
          
          // More aggressive fix: if we have {{d.xxx and no }}, add it
          fixedRunText = fixedRunText.replace(/\{\{([a-zA-Z0-9._]+)(?!\}\})/g, '{{$1}}');
          
          if (fixedRunText !== runText) {
            // Replace text nodes in this run
            let fixedRunXml = runXml;
            textMatches.forEach((textMatch, idx) => {
              const originalText = textMatch[1];
              // Calculate what the fixed text should be
              // This is tricky - we need to reconstruct
              const fixedText = fixedRunText.substring(
                idx === 0 ? 0 : textMatches.slice(0, idx).reduce((sum, m) => sum + m[1].length, 0),
                idx === 0 ? originalText.length : textMatches.slice(0, idx + 1).reduce((sum, m) => sum + m[1].length, 0)
              );
              
              if (fixedText !== originalText) {
                const fullTextMatch = textMatch[0];
                const attrs = textMatch[0].match(/<w:t([^>]*)>/)?.[1] || '';
                fixedRunXml = fixedRunXml.replace(
                  fullTextMatch,
                  `<w:t${attrs}>${fixedText}</w:t>`
                );
              }
            });
            
            fixes.push({
              original: runXml,
              fixed: fixedRunXml,
              index: runMatch.index
            });
            
            console.log(`  Found incomplete placeholder in run: "${runText.substring(0, 60)}"`);
          }
        }
      }
    }
    
    // Simpler approach: fix text nodes directly
    console.log('\nTrying simpler approach...');
    fixes = [];
    const simpleTextPattern = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
    let textMatch;
    
    while ((textMatch = simpleTextPattern.exec(xml)) !== null) {
      const fullMatch = textMatch[0];
      const attrs = textMatch[1];
      const text = textMatch[2];
      
      // Check for patterns like {{d.xxx without }}
      if (text.includes('{{') && !text.includes('}}')) {
        // This text node has {{ but no }}
        let fixedText = text;
        
        // Fix: {{d.xxx -> {{d.xxx}}
        fixedText = fixedText.replace(/\{\{([^}]+)$/g, '{{$1}}');
        fixedText = fixedText.replace(/\{\{([^}]+?)(?=\{\{|$)/g, (match, content) => {
          if (!match.endsWith('}}')) {
            return `{{${content}}}`;
          }
          return match;
        });
        
        if (fixedText !== text) {
          const fixedFull = `<w:t${attrs}>${fixedText}</w:t>`;
          fixes.push({ original: fullMatch, fixed: fixedFull });
          console.log(`  Fixing: "${text.substring(0, 50)}" -> "${fixedText.substring(0, 50)}"`);
        }
      } else if (text.match(/\{\{[^}]+\}\}/)) {
        // Has complete placeholder, but check if there are incomplete ones too
        const incompleteMatches = text.match(/\{\{[^}]+\}(?!\})/g);
        if (incompleteMatches) {
          let fixedText = text;
          incompleteMatches.forEach(match => {
            fixedText = fixedText.replace(match, match + '}');
          });
          
          if (fixedText !== text) {
            const fixedFull = `<w:t${attrs}>${fixedText}</w:t>`;
            fixes.push({ original: fullMatch, fixed: fixedFull });
            console.log(`  Fixing incomplete: "${text.substring(0, 50)}" -> "${fixedText.substring(0, 50)}"`);
          }
        }
      }
    }
    
    // Apply fixes
    if (fixes.length > 0) {
      console.log(`\nApplying ${fixes.length} fixes...`);
      // Apply in reverse order to preserve indices
      fixes.reverse().forEach(fix => {
        xml = xml.replace(fix.original, fix.fixed);
      });
      
      // Update the zip
      zip.file('word/document.xml', xml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`✅ Fixed ${fixes.length} text nodes`);
      
      // Verify
      const finalOpenCount = (xml.match(/\{\{/g) || []).length;
      const finalCloseCount = (xml.match(/\}\}/g) || []).length;
      console.log(`\nFinal count: ${finalOpenCount} {{ vs ${finalCloseCount} }}`);
      
      // Check for valid placeholders
      const validPlaceholders = [...xml.matchAll(/\{\{[^}]+\}\}/g)];
      console.log(`Valid placeholders: ${validPlaceholders.length}`);
      
      if (finalOpenCount === finalCloseCount) {
        console.log('✅ All placeholders are now balanced!');
      } else {
        console.warn(`⚠️ Still unmatched: ${finalOpenCount - finalCloseCount} difference`);
      }
    } else {
      console.log('⚠️ No fixes applied. Placeholders might be split across multiple XML nodes.');
      console.log('   This requires a more complex fix that combines text across runs.');
    }
    
  } catch (error) {
    console.error('Error fixing template:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  fixIncompletePlaceholders();
}

module.exports = { fixIncompletePlaceholders };









