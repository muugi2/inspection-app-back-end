const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function compareSignatureVsLoopImage() {
  try {
    console.log('='.repeat(80));
    console.log('Comparing Signature Image vs Loop Image Structure');
    console.log('='.repeat(80));
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find signature image
    const signaturePattern = /\{\{d\.signatures\.inspector\}\}/;
    const sigMatch = xml.match(signaturePattern);
    
    let signatureImage = null;
    if (sigMatch) {
      const sigIndex = xml.indexOf(sigMatch[0]);
      const sigContext = xml.substring(Math.max(0, sigIndex - 1000), sigIndex + 2000);
      const sigImageMatches = [...sigContext.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
      if (sigImageMatches.length > 0) {
        signatureImage = sigImageMatches[0][0];
      }
    }
    
    // Find first loop image
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/;
    const loopMatch = xml.match(loopPattern);
    
    let loopImage = null;
    if (loopMatch) {
      const loopPath = loopMatch[1];
      const loopIndex = xml.indexOf(loopMatch[0]);
      const closePattern = new RegExp(`\\{\\{/d\\.images\\.${loopPath.replace(/\./g, '\\.')}\\}\\}`);
      const closeMatch = xml.substring(loopIndex).match(closePattern);
      
      if (closeMatch) {
        const closeIndex = loopIndex + closeMatch.index;
        const loopContent = xml.substring(loopIndex, closeIndex + closeMatch[0].length);
        const loopImageMatches = [...loopContent.matchAll(/<w:drawing[^>]*>([\s\S]*?)<\/w:drawing>/gi)];
        if (loopImageMatches.length > 0) {
          loopImage = loopImageMatches[0][0];
        }
      }
    }
    
    if (!signatureImage || !loopImage) {
      console.log('❌ Could not find signature or loop image');
      return;
    }
    
    console.log('Signature Image Structure:');
    console.log('-'.repeat(80));
    extractImageInfo(signatureImage, 'Signature');
    
    console.log('\nLoop Image Structure:');
    console.log('-'.repeat(80));
    extractImageInfo(loopImage, 'Loop');
    
    console.log('\n' + '='.repeat(80));
    console.log('Comparison:');
    console.log('='.repeat(80));
    
    const sigInfo = extractImageInfo(signatureImage, 'Signature', true);
    const loopInfo = extractImageInfo(loopImage, 'Loop', true);
    
    console.log(`Alt Text:`);
    console.log(`  Signature: "${sigInfo.altText}"`);
    console.log(`  Loop: "${loopInfo.altText}"`);
    console.log(`  Match: ${sigInfo.altText === loopInfo.altText ? '✅' : '❌'}`);
    console.log('');
    
    console.log(`Structure elements:`);
    console.log(`  <a:blip>: Signature=${sigInfo.hasBlip}, Loop=${loopInfo.hasBlip}, Match=${sigInfo.hasBlip === loopInfo.hasBlip ? '✅' : '❌'}`);
    console.log(`  <pic:pic>: Signature=${sigInfo.hasPic}, Loop=${loopInfo.hasPic}, Match=${sigInfo.hasPic === loopInfo.hasPic ? '✅' : '❌'}`);
    console.log(`  <wp:inline>: Signature=${sigInfo.hasInline}, Loop=${loopInfo.hasInline}, Match=${sigInfo.hasInline === loopInfo.hasInline ? '✅' : '❌'}`);
    console.log('');
    
    // Check for differences that might affect easy-template-x
    console.log('Key differences that might affect easy-template-x:');
    console.log('-'.repeat(80));
    
    if (sigInfo.altText !== loopInfo.altText) {
      console.log(`❌ Alt Text differs: "${sigInfo.altText}" vs "${loopInfo.altText}"`);
      console.log(`   Signature image uses placeholder: ${sigInfo.altText.includes('{{')}`);
      console.log(`   Loop image uses placeholder: ${loopInfo.altText.includes('{{')}`);
    } else {
      console.log(`✅ Alt Text matches: "${sigInfo.altText}"`);
    }
    
    if (sigInfo.hasBlip !== loopInfo.hasBlip || sigInfo.hasPic !== loopInfo.hasPic || sigInfo.hasInline !== loopInfo.hasInline) {
      console.log(`❌ Structure differs`);
    } else {
      console.log(`✅ Structure matches`);
    }
    
    // Check XML length (signature images are usually larger)
    console.log(`\nXML size:`);
    console.log(`  Signature: ${signatureImage.length} bytes`);
    console.log(`  Loop: ${loopImage.length} bytes`);
    console.log(`  Difference: ${Math.abs(signatureImage.length - loopImage.length)} bytes`);
    
    // Check for r:embed (relationship ID)
    const sigHasRId = /r:embed=/gi.test(signatureImage);
    const loopHasRId = /r:embed=/gi.test(loopImage);
    console.log(`\nRelationship ID:`);
    console.log(`  Signature has r:embed: ${sigHasRId}`);
    console.log(`  Loop has r:embed: ${loopHasRId}`);
    console.log(`  Match: ${sigHasRId === loopHasRId ? '✅' : '❌'}`);
    
    if (sigHasRId && loopHasRId) {
      const sigRId = signatureImage.match(/r:embed=["']([^"']+)["']/gi)?.[0];
      const loopRId = loopImage.match(/r:embed=["']([^"']+)["']/gi)?.[0];
      console.log(`  Signature r:embed: ${sigRId || 'none'}`);
      console.log(`  Loop r:embed: ${loopRId || 'none'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

function extractImageInfo(imageXml, label, returnInfo = false) {
  const hasBlip = /<a:blip[^>]*>/gi.test(imageXml);
  const hasPic = /<pic:pic[^>]*>/gi.test(imageXml);
  const hasInline = /<wp:inline[^>]*>/gi.test(imageXml);
  const hasAnchor = /<wp:anchor[^>]*>/gi.test(imageXml);
  const hasAltText = /descr=/gi.test(imageXml);
  const altTextMatch = imageXml.match(/descr=["']([^"']+)["']/i);
  const altText = altTextMatch ? altTextMatch[1] : 'none';
  const hasRId = /r:embed=/gi.test(imageXml);
  const rId = imageXml.match(/r:embed=["']([^"']+)["']/gi)?.[0];
  
  if (returnInfo) {
    return {
      hasBlip,
      hasPic,
      hasInline,
      hasAnchor,
      hasAltText,
      altText,
      hasRId,
      rId,
    };
  }
  
  console.log(`  Has <a:blip>: ${hasBlip}`);
  console.log(`  Has <pic:pic>: ${hasPic}`);
  console.log(`  Has <wp:inline>: ${hasInline}`);
  console.log(`  Has <wp:anchor>: ${hasAnchor}`);
  console.log(`  Has Alt Text: ${hasAltText}`);
  console.log(`  Alt Text: "${altText}"`);
  console.log(`  Has r:embed: ${hasRId}`);
  if (rId) {
    console.log(`  r:embed: ${rId}`);
  }
  console.log(`  XML length: ${imageXml.length} bytes`);
}

if (require.main === module) {
  compareSignatureVsLoopImage();
}

module.exports = { compareSignatureVsLoopImage };

