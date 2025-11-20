const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function fixSplitPlaceholdersV2() {
  try {
    console.log('Fixing split placeholders (v2)...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    // Find all runs (w:r elements)
    const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    const runs = [];
    let runMatch;
    
    while ((runMatch = runPattern.exec(xml)) !== null) {
      runs.push({
        full: runMatch[0],
        content: runMatch[1],
        index: runMatch.index
      });
    }
    
    console.log(`Found ${runs.length} runs`);
    
    // Extract text from each run
    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const runTexts = runs.map(run => {
      const textMatches = [...run.content.matchAll(textPattern)];
      return {
        run: run,
        texts: textMatches.map(m => m[1]).join('')
      };
    });
    
    // Find split placeholders
    let fixes = [];
    for (let i = 0; i < runTexts.length - 1; i++) {
      const current = runTexts[i];
      const next = runTexts[i + 1];
      
      // Check if current ends with {{# or {{/ and next starts with field name ending with }}
      if (current.texts.match(/\{\{#?$/)) {
        // Current ends with {{# or {{
        if (next.texts.match(/^[a-zA-Z0-9_.]+}}$/)) {
          // Next starts with field name ending with }}
          const fieldName = next.texts.match(/^([a-zA-Z0-9_.]+)}}$/)[1];
          const prefix = current.texts.replace(/\{\{#?$/, '');
          
          // Combine into one placeholder
          const combined = prefix + `{{#${fieldName}}}`;
          
          // Find the text node in current run and replace
          const currentRunXml = current.run.full;
          const newCurrentRunXml = currentRunXml.replace(
            /<w:t([^>]*)>([^<]*)<\/w:t>/,
            (match, attrs, text) => {
              return `<w:t${attrs}>${combined}</w:t>`;
            }
          );
          
          // Remove text from next run
          const newNextRunXml = next.run.full.replace(
            /<w:t([^>]*)>([^<]*)<\/w:t>/,
            (match, attrs, text) => {
              return `<w:t${attrs}></w:t>`;
            }
          );
          
          fixes.push({
            old: current.run.full,
            new: newCurrentRunXml,
            index: current.run.index
          });
          
          fixes.push({
            old: next.run.full,
            new: newNextRunXml,
            index: next.run.index
          });
          
          console.log(`  Fixing: "${current.texts}" + "${next.texts}" -> "${combined}"`);
        }
      } else if (current.texts.match(/\{\{\/$/)) {
        // Current ends with {{/
        if (next.texts.match(/^[a-zA-Z0-9_.]+}}$/)) {
          const fieldName = next.texts.match(/^([a-zA-Z0-9_.]+)}}$/)[1];
          const prefix = current.texts.replace(/\{\{\/$/, '');
          const combined = prefix + `{{/${fieldName}}}`;
          
          const currentRunXml = current.run.full;
          const newCurrentRunXml = currentRunXml.replace(
            /<w:t([^>]*)>([^<]*)<\/w:t>/,
            (match, attrs, text) => {
              return `<w:t${attrs}>${combined}</w:t>`;
            }
          );
          
          const newNextRunXml = next.run.full.replace(
            /<w:t([^>]*)>([^<]*)<\/w:t>/,
            (match, attrs, text) => {
              return `<w:t${attrs}></w:t>`;
            }
          );
          
          fixes.push({
            old: current.run.full,
            new: newCurrentRunXml,
            index: current.run.index
          });
          
          fixes.push({
            old: next.run.full,
            new: newNextRunXml,
            index: next.run.index
          });
          
          console.log(`  Fixing: "${current.texts}" + "${next.texts}" -> "${combined}"`);
        }
      }
    }
    
    if (fixes.length > 0) {
      // Apply fixes in reverse order
      fixes.sort((a, b) => b.index - a.index);
      
      let newXml = xml;
      for (const fix of fixes) {
        newXml = newXml.replace(fix.old, fix.new);
      }
      
      // Update the zip
      zip.file('word/document.xml', newXml);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`\n✅ Applied ${fixes.length / 2} fixes and saved template!`);
      
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
  fixSplitPlaceholdersV2();
}

module.exports = { fixSplitPlaceholdersV2 };







