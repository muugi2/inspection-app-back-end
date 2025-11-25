const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * AGGRESSIVE template fix - removes ALL formatting and merges ALL text runs
 * Use this if the gentle approach doesn't work
 */
async function fixTemplateAggressive(templatePath) {
  console.log('⚡ AGGRESSIVE FIX - Reading template:', templatePath);
  console.log('⚠️  WARNING: This will remove ALL text formatting!\n');
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  let docXml = await zip.file('word/document.xml').async('string');
  console.log('Original document.xml length:', docXml.length);
  
  // AGGRESSIVE: Merge ALL text in each paragraph into a single run
  const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  
  let fixedXml = docXml.replace(paragraphPattern, (fullMatch, paraContent) => {
    // Extract ALL text from all runs
    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let allText = '';
    let match;
    
    while ((match = textPattern.exec(paraContent)) !== null) {
      allText += match[1];
    }
    
    // If empty paragraph, keep minimal structure
    if (!allText.trim()) {
      return '<w:p><w:r><w:t></w:t></w:r></w:p>';
    }
    
    // Extract paragraph properties if they exist
    const pPrMatch = paraContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    
    // Rebuild paragraph with single run
    return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${allText}</w:t></w:r></w:p>`;
  });
  
  console.log('Fixed document.xml length:', fixedXml.length);
  console.log('Size reduction:', docXml.length - fixedXml.length, 'bytes');
  
  // Verify
  const openCount = (fixedXml.match(/\{\{/g) || []).length;
  const closeCount = (fixedXml.match(/\}\}/g) || []).length;
  const placeholders = (fixedXml.match(/\{\{[^}]+\}\}/g) || []).length;
  
  console.log(`\n📊 Results:`);
  console.log(`  {{ : ${openCount}`);
  console.log(`  }} : ${closeCount}`);
  console.log(`  Complete placeholders: ${placeholders}`);
  
  if (openCount === closeCount) {
    console.log(`  ✅ BALANCED!`);
  } else {
    console.log(`  ❌ Still ${Math.abs(openCount - closeCount)} difference`);
  }
  
  // Save
  zip.file('word/document.xml', fixedXml);
  
  const fixedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  
  const backupPath = templatePath.replace('.docx', '.backup-aggressive.docx');
  await fs.copyFile(templatePath, backupPath);
  console.log(`\n✅ Backup: ${backupPath}`);
  
  await fs.writeFile(templatePath, fixedBuffer);
  console.log(`✅ Fixed: ${templatePath}`);
  
  return templatePath;
}

const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

fixTemplateAggressive(templatePath)
  .then(() => {
    console.log('\n🎉 Aggressive fix complete!');
    console.log('⚠️  Note: All text formatting has been removed');
    console.log('📝 Try downloading DOCX again');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });









