const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

async function verifyTemplateLoops() {
  try {
    console.log('='.repeat(80));
    console.log('Verifying template loops');
    console.log('='.repeat(80));
    console.log('');
    
    // Check file modification time
    const stats = fs.statSync(TEMPLATE_PATH);
    console.log(`Template file: ${TEMPLATE_PATH}`);
    console.log(`Last modified: ${stats.mtime}`);
    console.log(`File size: ${stats.size} bytes`);
    console.log('');
    
    const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
    const xml = await zip.file('word/document.xml').async('string');
    
    // Find all loop placeholders
    const loopPattern = /\{\{#d\.images\.([^\}]+)\}\}/g;
    const closingPattern = /\{\{\/d\.images\.([^\}]+)\}\}/g;
    
    const openLoops = [];
    let match;
    while ((match = loopPattern.exec(xml)) !== null) {
      openLoops.push({
        full: match[0],
        path: match[1],
        index: match.index,
      });
    }
    
    const closeLoops = [];
    while ((match = closingPattern.exec(xml)) !== null) {
      closeLoops.push({
        full: match[0],
        path: match[1],
        index: match.index,
      });
    }
    
    console.log(`Found ${openLoops.length} opening loops and ${closeLoops.length} closing loops\n`);
    
    // Check if placeholders are in separate text nodes (broken)
    const brokenLoops = [];
    openLoops.forEach(open => {
      // Find text node containing this placeholder
      const beforeXml = xml.substring(0, open.index);
      const afterXml = xml.substring(open.index);
      
      // Check if placeholder is split
      const textNodeBefore = beforeXml.match(/<w:t[^>]*>([^<]*)$/);
      const textNodeAfter = afterXml.match(/^([^<]*)<\/w:t>/);
      
      if (textNodeBefore && textNodeBefore[1] && !textNodeBefore[1].includes('{{#')) {
        // Placeholder might be split
        const textBefore = textNodeBefore[1];
        if (textBefore.trim().length > 0 && !textBefore.includes('{{')) {
          brokenLoops.push({
            loop: open.full,
            issue: 'Placeholder might be split across text nodes',
            before: textBefore.substring(0, 50),
          });
        }
      }
    });
    
    if (brokenLoops.length > 0) {
      console.log(`⚠️  Found ${brokenLoops.length} potentially broken loops:`);
      brokenLoops.slice(0, 5).forEach((broken, i) => {
        console.log(`   ${i + 1}. ${broken.loop}`);
        console.log(`      Issue: ${broken.issue}`);
      });
      console.log('');
    }
    
    // Expected fields
    const EXPECTED_FIELDS = {
      exterior: ['sensor_base', 'beam', 'platform_plate', 'beam_joint_plate', 'stop_bolt', 'interplatform_bolts'],
      indicator: ['led_display', 'power_plug', 'seal_bolt', 'buttons', 'junction_wiring', 'serial_converter_plug'],
      jbox: ['box_integrity', 'collector_board', 'wire_tightener', 'resistor_element', 'protective_box'],
      sensor: ['signal_wire', 'ball', 'base', 'ball_cup_thin', 'plate'],
      foundation: ['cross_base', 'anchor_plate', 'ramp_angle', 'ramp_stopper', 'ramp', 'slab_base'],
      cleanliness: ['under_platform', 'top_platform', 'gap_platform_ramp', 'both_sides_area'],
    };
    
    const totalExpected = Object.values(EXPECTED_FIELDS).reduce((sum, fields) => sum + fields.length, 0);
    
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log('-'.repeat(80));
    console.log(`Expected loops: ${totalExpected}`);
    console.log(`Found opening loops: ${openLoops.length}`);
    console.log(`Found closing loops: ${closeLoops.length}`);
    console.log('');
    
    if (openLoops.length === totalExpected && closeLoops.length === totalExpected) {
      console.log('✅ All loops are present!');
    } else {
      console.log(`❌ Missing ${totalExpected - openLoops.length} loops`);
      console.log('');
      console.log('💡 SOLUTION:');
      console.log('   1. Make sure you saved the template file (Ctrl+S in Word)');
      console.log('   2. Check that you saved to: templates/template.docx');
      console.log('   3. Verify each placeholder is on a separate paragraph');
      console.log('   4. Check that placeholder text is not split across multiple text nodes');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  verifyTemplateLoops();
}

module.exports = { verifyTemplateLoops };

