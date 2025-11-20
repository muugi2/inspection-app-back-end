const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fix broken delimiters in Word template by merging split text nodes
 */
async function fixTemplateDelimiters(templatePath) {
  console.log('Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  // Get document.xml
  const docXml = await zip.file('word/document.xml').async('string');
  console.log('Original document.xml length:', docXml.length);
  
  // Find all text nodes
  const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let matches = [...docXml.matchAll(textNodePattern)];
  console.log('Total text nodes:', matches.length);
  
  // Check for broken delimiters
  let brokenNodes = [];
  matches.forEach((match, index) => {
    const text = match[1];
    const openCount = (text.match(/\{\{/g) || []).length;
    const closeCount = (text.match(/\}\}/g) || []).length;
    
    if (openCount !== closeCount) {
      brokenNodes.push({
        index,
        text: text.substring(0, 100),
        open: openCount,
        close: closeCount,
        fullMatch: match[0]
      });
    }
  });
  
  if (brokenNodes.length === 0) {
    console.log('✅ No broken delimiters found!');
    return;
  }
  
  console.log(`❌ Found ${brokenNodes.length} broken text nodes:`);
  brokenNodes.slice(0, 10).forEach((node, i) => {
    console.log(`  ${i + 1}. {{ ${node.open} vs }} ${node.close}: "${node.text}"`);
  });
  
  // Strategy: Merge consecutive text nodes that are part of the same run
  // This is complex, so let's use a different approach:
  // Remove all formatting from placeholder text by replacing complex runs with simple ones
  
  let fixedXml = docXml;
  
  // Pattern to match text runs that might contain broken placeholders
  // We'll look for patterns like: <w:r>...<w:t>{{</w:t>...</w:r><w:r>...<w:t>d.</w:t>...</w:r><w:r>...<w:t>field}}</w:t>...</w:r>
  
  // First, let's try a simpler approach: find all runs between {{ and }}
  // and merge their text content
  
  // Find all occurrences of {{ and }}
  const openDelimiters = [];
  const closeDelimiters = [];
  
  let openRegex = /\{\{/g;
  let closeRegex = /\}\}/g;
  let match;
  
  while ((match = openRegex.exec(fixedXml)) !== null) {
    openDelimiters.push(match.index);
  }
  
  while ((match = closeRegex.exec(fixedXml)) !== null) {
    closeDelimiters.push(match.index);
  }
  
  console.log(`\nDelimiter positions:`);
  console.log(`  {{ at: ${openDelimiters.slice(0, 5).join(', ')}...`);
  console.log(`  }} at: ${closeDelimiters.slice(0, 5).join(', ')}...`);
  
  // More sophisticated approach: merge text within runs
  // Pattern: <w:r><w:rPr>...</w:rPr><w:t>text</w:t></w:r>
  // We want to merge consecutive <w:t> nodes within placeholder ranges
  
  // Let's use a regex to find run groups that contain part of a placeholder
  const runPattern = /<w:r>[\s\S]*?<\/w:r>/g;
  const runs = [...fixedXml.matchAll(runPattern)];
  
  console.log(`\nTotal runs found: ${runs.length}`);
  
  // Find runs that contain placeholder fragments
  let placeholderRuns = [];
  runs.forEach((run, index) => {
    const runText = run[0];
    const textContent = (runText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
      .map(t => t.replace(/<[^>]+>/g, ''))
      .join('');
    
    if (textContent.includes('{{') || textContent.includes('}}') || 
        (textContent.includes('d.') && index > 0 && placeholderRuns.length > 0)) {
      placeholderRuns.push({
        index,
        text: textContent,
        fullRun: runText,
        position: run.index
      });
    }
  });
  
  console.log(`\nRuns with placeholder content: ${placeholderRuns.length}`);
  placeholderRuns.slice(0, 10).forEach((run, i) => {
    console.log(`  ${i + 1}. [${run.index}] "${run.text}"`);
  });
  
  // Now we need to merge consecutive placeholder runs
  // Group consecutive runs
  let groups = [];
  let currentGroup = [];
  
  for (let i = 0; i < placeholderRuns.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(placeholderRuns[i]);
    } else {
      const lastRun = currentGroup[currentGroup.length - 1];
      const currentRun = placeholderRuns[i];
      
      // Check if runs are consecutive (with possible whitespace runs between)
      if (currentRun.index - lastRun.index <= 5) {
        currentGroup.push(currentRun);
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [currentRun];
      }
    }
  }
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  console.log(`\nGrouped into ${groups.length} placeholder groups`);
  
  // For each group, merge the text content
  groups.forEach((group, groupIndex) => {
    const combinedText = group.map(r => r.text).join('');
    console.log(`\nGroup ${groupIndex + 1}: "${combinedText}"`);
    
    // Check if this forms a complete placeholder
    const openCount = (combinedText.match(/\{\{/g) || []).length;
    const closeCount = (combinedText.match(/\}\}/g) || []).length;
    
    if (openCount > 0 && openCount === closeCount) {
      console.log(`  ✅ Complete placeholder(s) found, merging ${group.length} runs`);
      
      // Create a merged run with just the text, no formatting
      const mergedRun = `<w:r><w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
      
      // Replace the group of runs with the merged run
      // We need to find the exact position in the XML
      const firstRun = group[0];
      const lastRun = group[group.length - 1];
      
      // Find the start and end positions
      const startPos = firstRun.position;
      const endPos = lastRun.position + lastRun.fullRun.length;
      
      const before = fixedXml.substring(0, startPos);
      const after = fixedXml.substring(endPos);
      
      fixedXml = before + mergedRun + after;
      
      console.log(`  Replaced ${endPos - startPos} chars with ${mergedRun.length} chars`);
    } else if (openCount !== closeCount) {
      console.log(`  ⚠️ Incomplete placeholder: {{ ${openCount} vs }} ${closeCount}`);
    }
  });
  
  // Save the fixed template
  zip.file('word/document.xml', fixedXml);
  
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  const backupPath = templatePath.replace('.docx', '.backup.docx');
  const fixedPath = templatePath.replace('.docx', '.fixed.docx');
  
  // Backup original
  await fs.copyFile(templatePath, backupPath);
  console.log(`\n✅ Backup saved to: ${backupPath}`);
  
  // Save fixed version
  await fs.writeFile(fixedPath, fixedBuffer);
  console.log(`✅ Fixed template saved to: ${fixedPath}`);
  
  // Verify the fix
  const verifyZip = await JSZip.loadAsync(fixedBuffer);
  const verifyXml = await verifyZip.file('word/document.xml').async('string');
  
  const finalOpenCount = (verifyXml.match(/\{\{/g) || []).length;
  const finalCloseCount = (verifyXml.match(/\}\}/g) || []).length;
  
  console.log(`\n📊 Verification:`);
  console.log(`  {{ count: ${finalOpenCount}`);
  console.log(`  }} count: ${finalCloseCount}`);
  
  if (finalOpenCount === finalCloseCount) {
    console.log(`  ✅ All delimiters are now balanced!`);
    console.log(`\n🎉 Template fixed successfully!`);
    console.log(`\nTo use the fixed template, either:`);
    console.log(`  1. Replace the original: cp "${fixedPath}" "${templatePath}"`);
    console.log(`  2. Or update REPORT_TEMPLATE_FILE in your code to use the .fixed.docx file`);
  } else {
    console.log(`  ❌ Delimiters are still unbalanced`);
  }
}

// Run the script
const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

fixTemplateDelimiters(templatePath)
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });







