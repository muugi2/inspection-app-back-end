const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fix Word document by merging text runs that contain split placeholders
 * This approach preserves paragraph structure but removes formatting from placeholders
 */
async function fixWordRuns(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  let docXml = await zip.file('word/document.xml').async('string');
  console.log('Original document.xml length:', docXml.length);
  
  // Strategy: Find paragraphs, then within each paragraph, find runs that contain placeholder fragments
  // Merge consecutive runs that are part of the same placeholder
  
  // Split into paragraphs
  const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paragraphs = [];
  let match;
  let lastIndex = 0;
  
  while ((match = paragraphPattern.exec(docXml)) !== null) {
    // Save any content before this paragraph
    if (match.index > lastIndex) {
      paragraphs.push({
        type: 'other',
        content: docXml.substring(lastIndex, match.index)
      });
    }
    
    paragraphs.push({
      type: 'paragraph',
      fullMatch: match[0],
      content: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining content
  if (lastIndex < docXml.length) {
    paragraphs.push({
      type: 'other',
      content: docXml.substring(lastIndex)
    });
  }
  
  console.log(`Total paragraphs: ${paragraphs.filter(p => p.type === 'paragraph').length}`);
  
  // Process each paragraph
  let fixedParagraphs = [];
  let changesCount = 0;
  
  for (const para of paragraphs) {
    if (para.type !== 'paragraph') {
      fixedParagraphs.push(para.content);
      continue;
    }
    
    // Extract all runs from this paragraph
    const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    const runs = [];
    let runMatch;
    
    while ((runMatch = runPattern.exec(para.content)) !== null) {
      // Extract text from this run
      const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let text = '';
      let textMatch;
      
      while ((textMatch = textPattern.exec(runMatch[1])) !== null) {
        text += textMatch[1];
      }
      
      runs.push({
        fullRun: runMatch[0],
        text,
        start: runMatch.index,
        end: runMatch.index + runMatch[0].length
      });
    }
    
    // Check if this paragraph contains any placeholder fragments
    const fullText = runs.map(r => r.text).join('');
    const hasPlaceholder = fullText.includes('{{') || fullText.includes('}}') || 
                          (fullText.includes('d.') && (fullText.match(/\{/g) || []).length > 0);
    
    if (!hasPlaceholder) {
      // No placeholders, keep as is
      fixedParagraphs.push(para.fullMatch);
      continue;
    }
    
    // This paragraph has placeholders - we need to merge runs
    // Find groups of runs that form complete placeholders
    let inPlaceholder = false;
    let currentGroup = [];
    let groups = [];
    let nonPlaceholderRuns = [];
    
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const text = run.text;
      
      // Check if this run starts, continues, or ends a placeholder
      const hasOpen = text.includes('{{') || text.includes('{');
      const hasClose = text.includes('}}') || text.includes('}');
      const hasPath = text.match(/d\.[a-zA-Z_]/);
      
      if (hasOpen && !inPlaceholder) {
        // Start of placeholder
        inPlaceholder = true;
        currentGroup = [run];
      } else if (inPlaceholder) {
        currentGroup.push(run);
        
        if (hasClose) {
          // End of placeholder
          groups.push([...currentGroup]);
          currentGroup = [];
          inPlaceholder = false;
        }
      } else {
        // Not part of placeholder
        nonPlaceholderRuns.push(run);
      }
    }
    
    // Add any incomplete group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    if (groups.length === 0) {
      // No placeholder groups found, keep as is
      fixedParagraphs.push(para.fullMatch);
      continue;
    }
    
    // Rebuild paragraph by merging placeholder groups
    let newParaContent = para.content;
    
    // Process groups in reverse order (from end to start) to maintain positions
    groups.reverse();
    
    for (const group of groups) {
      if (group.length <= 1) continue; // No need to merge single runs
      
      const combinedText = group.map(r => r.text).join('');
      
      // Check if this is a valid placeholder
      if (!combinedText.includes('{') && !combinedText.includes('}')) {
        continue;
      }
      
      // Create merged run
      const mergedRun = `<w:r><w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
      
      // Find the span of these runs in the paragraph
      const firstRun = group[0];
      const lastRun = group[group.length - 1];
      
      const before = newParaContent.substring(0, firstRun.start);
      const after = newParaContent.substring(lastRun.end);
      
      newParaContent = before + mergedRun + after;
      
      // Adjust positions for remaining groups
      const lengthDiff = mergedRun.length - (lastRun.end - firstRun.start);
      for (const otherGroup of groups) {
        for (const run of otherGroup) {
          if (run.start < firstRun.start) {
            // No change needed
          } else if (run.start >= lastRun.end) {
            // Adjust position
            run.start += lengthDiff;
            run.end += lengthDiff;
          }
        }
      }
      
      changesCount++;
    }
    
    // Reconstruct paragraph
    const paraStart = para.fullMatch.substring(0, para.fullMatch.indexOf('>') + 1);
    const paraEnd = '</w:p>';
    fixedParagraphs.push(paraStart + newParaContent + paraEnd);
  }
  
  console.log(`\nMerged runs in ${changesCount} locations`);
  
  // Rebuild document
  const newDocXml = fixedParagraphs.join('');
  
  console.log(`New document.xml length: ${newDocXml.length}`);
  console.log(`Size change: ${newDocXml.length - docXml.length} bytes`);
  
  // Verify delimiters
  const openCount = (newDocXml.match(/\{\{/g) || []).length;
  const closeCount = (newDocXml.match(/\}\}/g) || []).length;
  
  console.log(`\n📊 Verification:`);
  console.log(`  {{ count: ${openCount}`);
  console.log(`  }} count: ${closeCount}`);
  
  if (openCount === closeCount) {
    console.log(`  ✅ Delimiters are balanced!`);
  } else {
    console.log(`  ⚠️ Delimiters still unbalanced: diff = ${Math.abs(openCount - closeCount)}`);
    console.log(`  This might be OK if there are single braces in the document`);
  }
  
  // Save
  zip.file('word/document.xml', newDocXml);
  
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  const backupPath = templatePath.replace('.docx', '.backup.docx');
  const fixedPath = templatePath.replace('.docx', '.fixed2.docx');
  
  // Check if backup already exists
  try {
    await fs.access(backupPath);
    console.log(`\n📋 Backup already exists: ${backupPath}`);
  } catch {
    await fs.copyFile(templatePath, backupPath);
    console.log(`\n✅ Backup saved to: ${backupPath}`);
  }
  
  await fs.writeFile(fixedPath, fixedBuffer);
  console.log(`✅ Fixed template saved to: ${fixedPath}`);
  
  return fixedPath;
}

const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

fixWordRuns(templatePath)
  .then((fixedPath) => {
    console.log(`\n🎉 Done! Fixed template: ${fixedPath}`);
    console.log(`\nTo use it, run:`);
    console.log(`   Copy-Item "${fixedPath}" -Destination "${templatePath}" -Force`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });







