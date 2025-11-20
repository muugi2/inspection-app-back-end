const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Merge split placeholders by combining consecutive text nodes
 */
async function mergePlaceholders(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  let docXml = await zip.file('word/document.xml').async('string');
  console.log('Original document.xml length:', docXml.length);
  
  // Strategy: Find runs that contain placeholder characters and merge their text content
  // Pattern: <w:r>...<w:t>text</w:t>...</w:r>
  
  // First, let's simplify by removing all runs that contain placeholder text
  // and replacing them with simple, unformatted runs
  
  // Extract text from all text nodes
  const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let textNodes = [];
  let match;
  
  while ((match = textNodePattern.exec(docXml)) !== null) {
    textNodes.push({
      text: match[1],
      start: match.index,
      end: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  console.log(`Total text nodes: ${textNodes.length}`);
  
  // Find placeholder boundaries
  let openBraces = [];
  let closeBraces = [];
  
  textNodes.forEach((node, index) => {
    if (node.text.includes('{{') || node.text === '{') {
      openBraces.push(index);
    }
    if (node.text.includes('}}') || node.text === '}') {
      closeBraces.push(index);
    }
  });
  
  console.log(`Nodes with {{ or {: ${openBraces.length}`);
  console.log(`Nodes with }} or }: ${closeBraces.length}`);
  
  // For each opening brace, find the corresponding closing brace
  let placeholderRanges = [];
  
  for (let i = 0; i < openBraces.length; i++) {
    const openIndex = openBraces[i];
    
    // Find the next closing brace after this opening
    let closeIndex = -1;
    for (let j = 0; j < closeBraces.length; j++) {
      if (closeBraces[j] > openIndex && closeBraces[j] < openIndex + 50) { // Within reasonable distance
        closeIndex = closeBraces[j];
        break;
      }
    }
    
    if (closeIndex > openIndex) {
      placeholderRanges.push({ start: openIndex, end: closeIndex });
    }
  }
  
  console.log(`\nFound ${placeholderRanges.length} placeholder ranges`);
  
  // For each range, extract and merge the text
  let replacements = [];
  
  for (const range of placeholderRanges) {
    const nodes = textNodes.slice(range.start, range.end + 1);
    const combinedText = nodes.map(n => n.text).join('');
    
    console.log(`\nRange [${range.start}-${range.end}]: "${combinedText}"`);
    
    // Check if this looks like a valid placeholder
    if (combinedText.includes('d.') || combinedText.includes('#') || combinedText.includes('/')) {
      const startPos = nodes[0].start;
      const endPos = nodes[nodes.length - 1].end;
      
      // Find the containing runs
      // We need to find <w:r>...</w:r> that contains these text nodes
      const beforeStart = docXml.substring(Math.max(0, startPos - 500), startPos);
      const afterEnd = docXml.substring(endPos, Math.min(docXml.length, endPos + 500));
      
      // Find the last <w:r> before start
      const lastRunStart = beforeStart.lastIndexOf('<w:r>');
      const actualStart = lastRunStart >= 0 ? (startPos - 500 + lastRunStart) : startPos;
      
      // Find the first </w:r> after end
      const firstRunEnd = afterEnd.indexOf('</w:r>');
      const actualEnd = firstRunEnd >= 0 ? (endPos + firstRunEnd + 6) : endPos;
      
      replacements.push({
        start: actualStart,
        end: actualEnd,
        oldText: docXml.substring(actualStart, actualEnd),
        newText: `<w:r><w:t xml:space="preserve">${combinedText}</w:t></w:r>`,
        combinedText
      });
    }
  }
  
  console.log(`\nPrepared ${replacements.length} replacements`);
  
  // Apply replacements in reverse order (from end to start)
  replacements.sort((a, b) => b.start - a.start);
  
  let modifiedXml = docXml;
  let totalSaved = 0;
  
  for (const replacement of replacements) {
    const before = modifiedXml.substring(0, replacement.start);
    const after = modifiedXml.substring(replacement.end);
    
    modifiedXml = before + replacement.newText + after;
    
    const saved = replacement.oldText.length - replacement.newText.length;
    totalSaved += saved;
    
    console.log(`  Replaced ${replacement.oldText.length} chars with ${replacement.newText.length} (saved ${saved})`);
    console.log(`    "${replacement.combinedText}"`);
  }
  
  console.log(`\nTotal space saved: ${totalSaved} characters`);
  console.log(`New document.xml length: ${modifiedXml.length}`);
  
  // Verify the result
  const openCount = (modifiedXml.match(/\{\{/g) || []).length;
  const closeCount = (modifiedXml.match(/\}\}/g) || []).length;
  
  console.log(`\n📊 Verification:`);
  console.log(`  {{ count: ${openCount}`);
  console.log(`  }} count: ${closeCount}`);
  
  if (openCount === closeCount) {
    console.log(`  ✅ Delimiters are balanced!`);
  } else {
    console.log(`  ⚠️ Still unbalanced: ${openCount} {{ vs ${closeCount} }}`);
  }
  
  // Save the fixed template
  zip.file('word/document.xml', modifiedXml);
  
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  const backupPath = templatePath.replace('.docx', '.backup.docx');
  const fixedPath = templatePath.replace('.docx', '.fixed.docx');
  
  // Check if backup already exists
  try {
    await fs.access(backupPath);
    console.log(`\n📋 Backup already exists: ${backupPath}`);
  } catch {
    // Backup doesn't exist, create it
    await fs.copyFile(templatePath, backupPath);
    console.log(`\n✅ Backup saved to: ${backupPath}`);
  }
  
  // Save fixed version
  await fs.writeFile(fixedPath, fixedBuffer);
  console.log(`✅ Fixed template saved to: ${fixedPath}`);
  
  console.log(`\n🎉 To use the fixed template, run:`);
  console.log(`   Copy-Item "${fixedPath}" -Destination "${templatePath}" -Force`);
  
  return fixedPath;
}

// Run the script
const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

mergePlaceholders(templatePath)
  .then((fixedPath) => {
    console.log('\n✅ Script completed successfully!');
    console.log(`\nFixed template: ${fixedPath}`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });







