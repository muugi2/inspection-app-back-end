const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

const RUN_REGEX = /<w:r\b[\s\S]*?<\/w:r>/g;
const TEXT_REGEX = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

function extractRunText(runXml) {
  const matches = [...runXml.matchAll(TEXT_REGEX)];
  if (!matches.length) {
    return '';
  }
  return matches.map((m) => m[1] || '').join('');
}

async function fixAllSplitPlaceholders() {
  try {
    console.log('Fixing ALL split placeholders...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    let xml = await zip.file('word/document.xml').async('string');
    
    const originalXml = xml;
    const runs = [...xml.matchAll(RUN_REGEX)];
    const replacements = [];
    
    console.log(`Found ${runs.length} runs`);
    
    let i = 0;
    while (i < runs.length) {
      const runMatch = runs[i];
      const runText = extractRunText(runMatch[0]);
      
      if (!runText.includes('{')) {
        i += 1;
        continue;
      }
      
      // Combine text from multiple runs if placeholder is split
      let combinedText = runText;
      let j = i + 1;
      let maxLookAhead = 10; // Limit lookahead to prevent infinite loops
      
      while (!combinedText.includes('}}') && j < runs.length && maxLookAhead > 0) {
        const nextRunText = extractRunText(runs[j][0]);
        combinedText += nextRunText;
        j += 1;
        maxLookAhead -= 1;
      }
      
      if (!combinedText.includes('}}')) {
        i += 1;
        continue;
      }
      
      // Find all placeholders in combined text
      const placeholderPattern = /\{\{([^}]+)\}\}/g;
      const placeholders = [...combinedText.matchAll(placeholderPattern)];
      
      if (placeholders.length === 0) {
        i += 1;
        continue;
      }
      
      // Check if placeholder is split across runs
      // If the placeholder starts in first run but ends in later run, we need to fix it
      for (const placeholder of placeholders) {
        const placeholderText = placeholder[0]; // e.g., "{{#d.hasImages.exterior.sensor_base}}"
        const placeholderContent = placeholder[1]; // e.g., "#d.hasImages.exterior.sensor_base"
        
        // Find where this placeholder starts and ends in combined text
        const startPos = combinedText.indexOf(placeholderText);
        const endPos = startPos + placeholderText.length;
        
        // Check if placeholder spans multiple runs
        let currentPos = 0;
        let startRunIndex = i;
        let endRunIndex = i;
        
        for (let k = i; k < j; k++) {
          const runText = extractRunText(runs[k][0]);
          const runStart = currentPos;
          const runEnd = currentPos + runText.length;
          
          if (startPos >= runStart && startPos < runEnd) {
            startRunIndex = k;
          }
          if (endPos > runStart && endPos <= runEnd) {
            endRunIndex = k;
          }
          
          currentPos = runEnd;
        }
        
        // If placeholder spans multiple runs, fix it
        if (startRunIndex !== endRunIndex) {
          console.log(`  Fixing split placeholder: "${placeholderContent}" (runs ${startRunIndex}-${endRunIndex})`);
          
          // Replace first run with complete placeholder
          const firstRun = runs[startRunIndex];
          let firstRunXml = firstRun[0];
          
          // Find and replace the text node
          firstRunXml = firstRunXml.replace(
            /<w:t[^>]*>[\s\S]*?<\/w:t>/,
            `<w:t>${placeholderText}</w:t>`
          );
          
          replacements.push({
            start: firstRun.index,
            end: firstRun.index + firstRun[0].length,
            replacement: firstRunXml,
          });
          
          // Remove other runs that were part of this placeholder
          for (let k = startRunIndex + 1; k <= endRunIndex; k++) {
            const runToRemove = runs[k];
            // Only remove if the run only contains part of the placeholder
            const runText = extractRunText(runToRemove[0]);
            if (runText && (runText.includes('{{') || runText.includes('}}'))) {
              replacements.push({
                start: runToRemove.index,
                end: runToRemove.index + runToRemove[0].length,
                replacement: '',
              });
            }
          }
          
          // Move to after the last run we processed
          i = endRunIndex + 1;
          break; // Only fix first placeholder per iteration
        }
      }
      
      if (i === runMatch.index) {
        i += 1; // Prevent infinite loop
      }
    }
    
    // Apply replacements in reverse order (to preserve indices)
    replacements.sort((a, b) => b.start - a.start);
    
    let output = xml;
    for (const { start, end, replacement } of replacements) {
      output = output.slice(0, start) + replacement + output.slice(end);
    }
    
    // Clean up empty runs
    output = output.replace(/<w:r[^>]*><\/w:r>/g, '');
    output = output.replace(/<w:t[^>]*><\/w:t>/g, '');
    
    if (output !== originalXml) {
      // Update the zip
      zip.file('word/document.xml', output);
      
      // Save the file
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(TEMPLATE_PATH, buffer);
      
      console.log(`\n✅ Applied ${replacements.length} fixes and saved template!`);
      
      // Verify
      const finalOpen = (output.match(/\{\{/g) || []).length;
      const finalClose = (output.match(/\}\}/g) || []).length;
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
  fixAllSplitPlaceholders();
}

module.exports = { fixAllSplitPlaceholders };

