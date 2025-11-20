const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function debugSensorBasePlaceholders() {
  try {
    console.log('Debugging sensor_base placeholders...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all text nodes that contain sensor_base related placeholders
    const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const runs = [];
    let match;
    
    while ((match = textNodePattern.exec(xml)) !== null) {
      const text = match[1];
      if (text.includes('sensor_base') || text.includes('{{#') || text.includes('{{/') || text.includes('}}')) {
        runs.push({
          text: text,
          index: match.index,
          full: match[0]
        });
      }
    }
    
    console.log(`Found ${runs.length} text nodes with sensor_base or placeholders\n`);
    
    // Find sensor_base section
    const sensorBaseIndex = xml.indexOf('sensor_base');
    if (sensorBaseIndex === -1) {
      console.log('❌ sensor_base not found in XML');
      return;
    }
    
    // Extract context around sensor_base (500 chars before and after)
    const contextStart = Math.max(0, sensorBaseIndex - 500);
    const contextEnd = Math.min(xml.length, sensorBaseIndex + 1000);
    const context = xml.substring(contextStart, contextEnd);
    
    console.log('Context around sensor_base:');
    console.log('='.repeat(80));
    console.log(context);
    console.log('='.repeat(80));
    console.log();
    
    // Check for split placeholders
    console.log('Checking for split placeholders...\n');
    
    // Find all runs that might be split
    const splitPatterns = [];
    
    // Pattern 1: {{# in one node, rest in another
    for (let i = 0; i < runs.length - 1; i++) {
      const current = runs[i];
      const next = runs[i + 1];
      
      if (current.text.trim() === '{{#' || current.text.trim().startsWith('{{#')) {
        if (next.text.includes('sensor_base') || next.text.includes('}}')) {
          splitPatterns.push({
            type: 'split open',
            current: current.text,
            next: next.text,
            index: i
          });
        }
      }
      
      if (current.text.trim() === '{{/' || current.text.trim().startsWith('{{/')) {
        if (next.text.trim() === '}}' || next.text.includes('}}')) {
          splitPatterns.push({
            type: 'split close',
            current: current.text,
            next: next.text,
            index: i
          });
        }
      }
    }
    
    if (splitPatterns.length > 0) {
      console.log(`Found ${splitPatterns.length} split placeholder patterns:\n`);
      splitPatterns.forEach((pattern, i) => {
        console.log(`${i + 1}. ${pattern.type}:`);
        console.log(`   Current: "${pattern.current}"`);
        console.log(`   Next: "${pattern.next}"`);
        console.log();
      });
    } else {
      console.log('✅ No obvious split patterns found');
    }
    
    // Check for complete placeholders
    const completePlaceholders = [
      '{{#d.hasImages.exterior.sensor_base}}',
      '{{#d.images.exterior.sensor_base}}',
      '{{/d.images.exterior.sensor_base}}',
      '{{/d.hasImages.exterior.sensor_base}}'
    ];
    
    console.log('Checking for complete placeholders:');
    completePlaceholders.forEach(placeholder => {
      const found = xml.includes(placeholder);
      console.log(`  ${found ? '✅' : '❌'} ${placeholder}`);
    });
    
    // Find exact location of sensor_base placeholders
    console.log('\nFinding exact locations...');
    const hasImagesOpen = xml.indexOf('{{#d.hasImages.exterior.sensor_base}}');
    const imagesOpen = xml.indexOf('{{#d.images.exterior.sensor_base}}');
    const imagesClose = xml.indexOf('{{/d.images.exterior.sensor_base}}');
    const hasImagesClose = xml.indexOf('{{/d.hasImages.exterior.sensor_base}}');
    
    console.log(`hasImages open: ${hasImagesOpen >= 0 ? `Found at ${hasImagesOpen}` : 'NOT FOUND'}`);
    console.log(`images open: ${imagesOpen >= 0 ? `Found at ${imagesOpen}` : 'NOT FOUND'}`);
    console.log(`images close: ${imagesClose >= 0 ? `Found at ${imagesClose}` : 'NOT FOUND'}`);
    console.log(`hasImages close: ${hasImagesClose >= 0 ? `Found at ${hasImagesClose}` : 'NOT FOUND'}`);
    
    // Check if placeholders are in separate text nodes
    if (hasImagesOpen >= 0) {
      const before = xml.substring(Math.max(0, hasImagesOpen - 100), hasImagesOpen);
      const after = xml.substring(hasImagesOpen, Math.min(xml.length, hasImagesOpen + 200));
      console.log('\nContext around hasImages open:');
      console.log('Before:', before.substring(before.length - 50));
      console.log('After:', after.substring(0, 100));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  debugSensorBasePlaceholders();
}

module.exports = { debugSensorBasePlaceholders };







