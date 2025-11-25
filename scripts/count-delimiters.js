const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

async function countDelimiters(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  const docXml = await zip.file('word/document.xml').async('string');
  console.log('Document.xml length:', docXml.length);
  
  // Count delimiters in the raw XML
  const openDelimiters = docXml.match(/\{\{/g) || [];
  const closeDelimiters = docXml.match(/\}\}/g) || [];
  
  console.log(`\n📊 Delimiter counts in XML:`);
  console.log(`  Opening {{ : ${openDelimiters.length}`);
  console.log(`  Closing }} : ${closeDelimiters.length}`);
  console.log(`  Difference: ${Math.abs(openDelimiters.length - closeDelimiters.length)}`);
  
  if (openDelimiters.length === closeDelimiters.length) {
    console.log(`\n✅ Delimiters are balanced!`);
  } else {
    console.log(`\n❌ Delimiters are NOT balanced!`);
    
    // Try to find where the imbalance occurs
    console.log(`\nSearching for imbalanced regions...`);
    
    let openCount = 0;
    let closeCount = 0;
    let imbalancedPositions = [];
    
    // Split by lines for easier debugging
    const lines = docXml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(/\{\{/g) || []).length;
      const closes = (line.match(/\}\}/g) || []).length;
      
      openCount += opens;
      closeCount += closes;
      
      if (openCount !== closeCount) {
        imbalancedPositions.push({
          line: i + 1,
          opens: openCount,
          closes: closeCount,
          diff: openCount - closeCount,
          text: line.substring(0, 100)
        });
      }
    }
    
    console.log(`\nFirst 10 imbalanced positions:`);
    imbalancedPositions.slice(0, 10).forEach(pos => {
      console.log(`  Line ${pos.line}: {{ ${pos.opens} vs }} ${pos.closes} (diff: ${pos.diff})`);
      console.log(`    "${pos.text}"`);
    });
  }
  
  // Find all complete placeholders
  const placeholderPattern = /\{\{[^}]+\}\}/g;
  const placeholders = docXml.match(placeholderPattern) || [];
  
  console.log(`\n📝 Complete placeholders found: ${placeholders.length}`);
  console.log(`\nSample placeholders:`);
  placeholders.slice(0, 10).forEach((placeholder, i) => {
    console.log(`  ${i + 1}. ${placeholder}`);
  });
}

const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

countDelimiters(templatePath)
  .then(() => {
    console.log('\n✅ Analysis completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });









