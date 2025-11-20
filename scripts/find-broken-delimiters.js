const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function findBrokenDelimiters() {
  try {
    console.log('='.repeat(80));
    console.log('Finding broken delimiters in template');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes with delimiters
    const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const problematicNodes = [];
    let match;
    let nodeIndex = 0;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      const text = match[1];
      const openCount = (text.match(/\{\{/g) || []).length;
      const closeCount = (text.match(/\}\}/g) || []).length;
      
      if (openCount !== closeCount) {
        problematicNodes.push({
          index: nodeIndex++,
          text: text.substring(0, 150),
          open: openCount,
          close: closeCount,
          position: match.index,
        });
      } else if (text.includes('{{') || text.includes('}}')) {
        nodeIndex++;
      }
    }
    
    console.log(`Found ${problematicNodes.length} problematic text nodes:\n`);
    
    problematicNodes.forEach((node, i) => {
      console.log(`${i + 1}. Text node at position ${node.position}:`);
      console.log(`   Text: "${node.text}"`);
      console.log(`   {{ count: ${node.open}, }} count: ${node.close}`);
      console.log('');
    });
    
    // Try to find which placeholder is broken
    console.log('\n' + '='.repeat(80));
    console.log('Attempting to identify broken placeholder:');
    console.log('-'.repeat(80));
    
    // Look for patterns that suggest a broken placeholder
    problematicNodes.slice(0, 10).forEach((node, i) => {
      const text = node.text;
      
      // Check if it looks like start of a placeholder
      if (text.includes('{{#') && !text.includes('}}')) {
        console.log(`\n${i + 1}. Possible broken opening placeholder:`);
        console.log(`   "${text}"`);
        console.log(`   Missing closing }}`);
      }
      
      // Check if it looks like end of a placeholder
      if (text.includes('}}') && !text.includes('{{')) {
        console.log(`\n${i + 1}. Possible broken closing placeholder:`);
        console.log(`   "${text}"`);
        console.log(`   Missing opening {{`);
      }
      
      // Check if it looks like middle of a placeholder
      if (!text.includes('{{') && !text.includes('}}') && 
          (text.includes('d.') || text.includes('image') || text.includes('signatures'))) {
        console.log(`\n${i + 1}. Possible middle of broken placeholder:`);
        console.log(`   "${text}"`);
      }
    });
    
    // Check for FTP image placeholder specifically
    console.log('\n' + '='.repeat(80));
    console.log('Checking for FTP image placeholder:');
    console.log('-'.repeat(80));
    
    const ftpMatches = xml.match(/ftp[^<]*image[^<]*/gi) || [];
    if (ftpMatches.length > 0) {
      console.log(`Found ${ftpMatches.length} mentions of "ftp" and "image":`);
      ftpMatches.slice(0, 5).forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.substring(0, 100)}`);
      });
    } else {
      console.log('No mentions of "ftp" and "image" found together');
    }
    
    // Check for d.ftp_image placeholder
    const ftpImagePattern = /\{\{d\.ftp_image\}\}/g;
    const ftpImageMatches = xml.match(ftpImagePattern) || [];
    console.log(`\nFound ${ftpImageMatches.length} complete {{d.ftp_image}} placeholders`);
    
    // Check for broken d.ftp_image
    const brokenFtpImage1 = xml.match(/\{\{d\.ftp_image/gi) || [];
    const brokenFtpImage2 = xml.match(/d\.ftp_image\}\}/gi) || [];
    console.log(`Found ${brokenFtpImage1.length} opening {{d.ftp_image (possibly broken)`);
    console.log(`Found ${brokenFtpImage2.length} closing d.ftp_image}} (possibly broken)`);
    
    if (brokenFtpImage1.length > ftpImageMatches.length) {
      console.log('\n⚠️  WARNING: More opening {{d.ftp_image than complete placeholders!');
      console.log('   This suggests a broken placeholder.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  findBrokenDelimiters();
}

module.exports = { findBrokenDelimiters };
