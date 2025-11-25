const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fix Word template for easy-template-x by:
 * 1. Finding all text runs within paragraphs
 * 2. Merging consecutive runs into single runs to prevent split placeholders
 * 3. Removing unnecessary formatting from placeholder text
 */
async function fixTemplate(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  let docXml = await zip.file('word/document.xml').async('string');
  console.log('Original document.xml length:', docXml.length);
  
  // Strategy: Within each paragraph, merge all consecutive text runs
  // This will eliminate split placeholders while preserving paragraph structure
  
  // Process each paragraph
  const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let fixedXml = docXml.replace(paragraphPattern, (fullMatch, paraContent) => {
    // Extract all text from runs in this paragraph
    const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    
    let allText = '';
    let match;
    
    // Collect all text from this paragraph
    while ((match = runPattern.exec(paraContent)) !== null) {
      const runContent = match[1];
      let textMatch;
      while ((textMatch = textPattern.exec(runContent)) !== null) {
        allText += textMatch[1];
      }
    }
    
    // If paragraph is empty, keep as is
    if (!allText) {
      return fullMatch;
    }
    
    // Check if this paragraph contains placeholder text
    const hasPlaceholder = allText.includes('{{') || allText.includes('}}');
    
    if (!hasPlaceholder) {
      // No placeholders, keep as is
      return fullMatch;
    }
    
    // This paragraph has placeholders - rebuild it with merged runs
    // Get paragraph properties (everything before first <w:r>)
    const firstRunIndex = paraContent.indexOf('<w:r');
    const paraPrefix = firstRunIndex > 0 ? paraContent.substring(0, firstRunIndex) : '';
    
    // Create a single run with all text
    const newRun = `<w:r><w:t xml:space="preserve">${allText}</w:t></w:r>`;
    
    // Reconstruct paragraph
    const paraStart = fullMatch.substring(0, fullMatch.indexOf('>') + 1);
    return paraStart + paraPrefix + newRun + '</w:p>';
  });
  
  console.log('Fixed document.xml length:', fixedXml.length);
  console.log('Size change:', fixedXml.length - docXml.length);
  
  // Verify delimiters
  const openCount = (fixedXml.match(/\{\{/g) || []).length;
  const closeCount = (fixedXml.match(/\}\}/g) || []).length;
  
  console.log(`\n📊 Verification:`);
  console.log(`  {{ count: ${openCount}`);
  console.log(`  }} count: ${closeCount}`);
  
  if (openCount === closeCount) {
    console.log(`  ✅ Delimiters are balanced!`);
  } else {
    console.log(`  ⚠️ Delimiters unbalanced: ${Math.abs(openCount - closeCount)} difference`);
  }
  
  // Check for complete placeholders
  const placeholderPattern = /\{\{[^}]+\}\}/g;
  const placeholders = fixedXml.match(placeholderPattern) || [];
  console.log(`  ✅ Complete placeholders: ${placeholders.length}`);
  
  // Save the fixed template
  zip.file('word/document.xml', fixedXml);
  
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  // Backup original
  const backupPath = templatePath.replace('.docx', '.backup.docx');
  try {
    await fs.access(backupPath);
    console.log(`\n📋 Backup already exists: ${backupPath}`);
  } catch {
    await fs.copyFile(templatePath, backupPath);
    console.log(`\n✅ Backup created: ${backupPath}`);
  }
  
  // Save fixed version
  await fs.writeFile(templatePath, fixedBuffer);
  console.log(`✅ Fixed template saved: ${templatePath}`);
  
  return templatePath;
}

const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

fixTemplate(templatePath)
  .then(() => {
    console.log('\n🎉 Template fixed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your server if needed');
    console.log('   2. Try downloading the DOCX again');
    console.log(`   3. If issues persist, restore backup and edit manually in Word`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });









