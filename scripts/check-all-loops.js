const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkAllLoops() {
  try {
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    const allLoops = [...xml.matchAll(/\{\{#d\.images\.([^\}]+)\}\}/g)];
    console.log('All loop placeholders found:');
    allLoops.forEach((m, i) => console.log(`  ${i+1}. ${m[0]} -> ${m[1]}`));
    console.log(`\nTotal: ${allLoops.length} loops\n`);
    
    const sections = {};
    allLoops.forEach(m => {
      const path = m[1];
      const [section] = path.split('.');
      if (!sections[section]) sections[section] = [];
      sections[section].push(path);
    });
    
    console.log('By section:');
    Object.keys(sections).sort().forEach(s => {
      console.log(`  ${s}: ${sections[s].length} loops`);
      sections[s].forEach(p => console.log(`    - ${p}`));
    });
    
    // Expected sections
    const expectedSections = ['exterior', 'foundation', 'indicator', 'jbox', 'sensor', 'cleanliness'];
    console.log('\nMissing sections:');
    expectedSections.forEach(s => {
      if (!sections[s] || sections[s].length === 0) {
        console.log(`  ❌ ${s}: No loops found`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllLoops();





