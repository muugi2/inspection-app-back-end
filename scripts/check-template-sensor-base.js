const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'template.docx'
);

async function checkSensorBase() {
  try {
    console.log('Checking template for sensor_base placeholders...\n');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Check for hasImages conditions
    const hasImages = [...xml.matchAll(/\{\{#d\.hasImages\.[^}]+\}\}/g)];
    console.log(`Found hasImages conditions: ${hasImages.length}`);
    if (hasImages.length > 0) {
      console.log('Sample hasImages:');
      hasImages.slice(0, 5).forEach(m => console.log(`  ${m[0]}`));
    }
    
    // Check for images loops
    const imagesLoop = [...xml.matchAll(/\{\{#d\.images\.[^}]+\}\}/g)];
    console.log(`\nFound images loops: ${imagesLoop.length}`);
    if (imagesLoop.length > 0) {
      console.log('Sample images loops:');
      imagesLoop.slice(0, 5).forEach(m => console.log(`  ${m[0]}`));
    }
    
    // Check for closing tags
    const imagesLoopClose = [...xml.matchAll(/\{\{\/d\.images\.[^}]+\}\}/g)];
    const hasImagesClose = [...xml.matchAll(/\{\{\/d\.hasImages\.[^}]+\}\}/g)];
    console.log(`\nFound images loop closes: ${imagesLoopClose.length}`);
    console.log(`Found hasImages closes: ${hasImagesClose.length}`);
    
    // Check for sensor_base specifically
    console.log('\n=== Checking for sensor_base specifically ===');
    const sensorBaseHas = xml.match(/\{\{#d\.hasImages\.exterior\.sensor_base\}\}/g);
    const sensorBaseImages = xml.match(/\{\{#d\.images\.exterior\.sensor_base\}\}/g);
    const sensorBaseImagesClose = xml.match(/\{\{\/d\.images\.exterior\.sensor_base\}\}/g);
    const sensorBaseHasClose = xml.match(/\{\{\/d\.hasImages\.exterior\.sensor_base\}\}/g);
    
    console.log(`sensor_base hasImages: ${sensorBaseHas ? sensorBaseHas.length : 0}`);
    console.log(`sensor_base images loop: ${sensorBaseImages ? sensorBaseImages.length : 0}`);
    console.log(`sensor_base images close: ${sensorBaseImagesClose ? sensorBaseImagesClose.length : 0}`);
    console.log(`sensor_base hasImages close: ${sensorBaseHasClose ? sensorBaseHasClose.length : 0}`);
    
    // Check for "Мэдрэгчийн суурь" text
    const sensorBaseText = xml.match(/Мэдрэгчийн суурь/g);
    console.log(`\n"Мэдрэгчийн суурь" text found: ${sensorBaseText ? sensorBaseText.length : 0} times`);
    
    // Try to find context around sensor_base
    const sensorBaseIndex = xml.indexOf('sensor_base');
    if (sensorBaseIndex !== -1) {
      const context = xml.substring(Math.max(0, sensorBaseIndex - 200), Math.min(xml.length, sensorBaseIndex + 500));
      console.log('\n=== Context around sensor_base ===');
      console.log(context.replace(/\n/g, ' ').substring(0, 500));
    }
    
    // Check for image placeholders with Alt Text "image"
    const imageAltText = xml.match(/descr=["']image["']/gi) || [];
    const imageAltText2 = xml.match(/name=["']image["']/gi) || [];
    console.log(`\nImage Alt Text "image" found: ${imageAltText.length + imageAltText2.length} times`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  checkSensorBase();
}

module.exports = { checkSensorBase };









