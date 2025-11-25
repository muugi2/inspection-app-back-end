const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

async function validateLoops(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  const docXml = await zip.file('word/document.xml').async('string');
  console.log('Document.xml length:', docXml.length);
  
  // Find all placeholders
  const placeholderPattern = /\{\{[#/]?[^}]+\}\}/g;
  const placeholders = [];
  let match;
  
  while ((match = placeholderPattern.exec(docXml)) !== null) {
    placeholders.push({
      text: match[0],
      position: match.index
    });
  }
  
  console.log(`\nFound ${placeholders.length} complete placeholders\n`);
  
  // Analyze loop structure
  const loopStack = [];
  const loops = [];
  const errors = [];
  
  placeholders.forEach((placeholder, index) => {
    const text = placeholder.text;
    
    if (text.startsWith('{{#')) {
      // Opening tag
      const tagName = text.substring(3, text.length - 2);
      loopStack.push({ name: tagName, index, placeholder });
      console.log(`${' '.repeat(loopStack.length * 2)}#${tagName}`);
      
    } else if (text.startsWith('{{/')) {
      // Closing tag
      const tagName = text.substring(3, text.length - 2);
      console.log(`${' '.repeat(loopStack.length * 2)}/${tagName}`);
      
      if (loopStack.length === 0) {
        errors.push({
          type: 'unopened',
          tag: tagName,
          position: placeholder.position
        });
        console.log(`  ❌ ERROR: Closing tag without opening: /${tagName}`);
      } else {
        const openTag = loopStack.pop();
        
        if (openTag.name === tagName) {
          loops.push({
            name: tagName,
            start: openTag.index,
            end: index
          });
        } else {
          errors.push({
            type: 'mismatch',
            expected: openTag.name,
            found: tagName,
            position: placeholder.position
          });
          console.log(`  ❌ ERROR: Mismatched tags: expected /${openTag.name}, found /${tagName}`);
        }
      }
    }
  });
  
  // Check for unclosed tags
  if (loopStack.length > 0) {
    console.log(`\n❌ UNCLOSED TAGS:`);
    loopStack.forEach(tag => {
      console.log(`   ${tag.name} (opened at index ${tag.index})`);
      errors.push({
        type: 'unclosed',
        tag: tag.name,
        position: tag.placeholder.position
      });
    });
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Complete loops: ${loops.length}`);
  console.log(`   Errors: ${errors.length}`);
  
  if (errors.length === 0) {
    console.log(`\n✅ All loop tags are properly balanced!`);
  } else {
    console.log(`\n❌ Found ${errors.length} errors:`);
    errors.forEach((error, i) => {
      console.log(`\n   ${i + 1}. ${error.type.toUpperCase()}`);
      console.log(`      Tag: ${error.tag || error.expected}`);
      console.log(`      Position: ${error.position}`);
      if (error.found) {
        console.log(`      Found instead: ${error.found}`);
      }
    });
  }
  
  // Show all loops
  if (loops.length > 0) {
    console.log(`\n📝 Complete loops:`);
    loops.forEach((loop, i) => {
      console.log(`   ${i + 1}. ${loop.name}`);
    });
  }
}

const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

validateLoops(templatePath)
  .then(() => {
    console.log('\n✅ Validation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });









