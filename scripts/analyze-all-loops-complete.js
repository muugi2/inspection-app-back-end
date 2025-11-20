const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'template.docx');

// Expected fields based on backend code
const EXPECTED_FIELDS = {
  exterior: ['sensor_base', 'beam', 'platform_plate', 'beam_joint_plate', 'stop_bolt', 'interplatform_bolts'],
  indicator: ['led_display', 'power_plug', 'seal_bolt', 'buttons', 'junction_wiring', 'serial_converter_plug'],
  jbox: ['box_integrity', 'collector_board', 'wire_tightener', 'resistor_element', 'protective_box'],
  sensor: ['signal_wire', 'ball', 'base', 'ball_cup_thin', 'plate'],
  foundation: ['cross_base', 'anchor_plate', 'ramp_angle', 'ramp_stopper', 'ramp', 'slab_base'],
  cleanliness: ['under_platform', 'top_platform', 'gap_platform_ramp', 'both_sides_area'],
};

async function analyzeAllLoops() {
  try {
    console.log('='.repeat(80));
    console.log('Complete Template Loop Analysis');
    console.log('='.repeat(80));
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
    
    // Match open and close loops
    const matchedLoops = [];
    const unmatchedOpens = [];
    const unmatchedCloses = [];
    
    openLoops.forEach(open => {
      const close = closeLoops.find(c => 
        c.path === open.path && c.index > open.index
      );
      
      if (close) {
        matchedLoops.push({
          path: open.path,
          open: open,
          close: close,
          content: xml.substring(open.index, close.index + close.full.length),
        });
      } else {
        unmatchedOpens.push(open);
      }
    });
    
    closeLoops.forEach(close => {
      const matched = matchedLoops.find(m => m.close.index === close.index);
      if (!matched) {
        unmatchedCloses.push(close);
      }
    });
    
    // Group by section
    const loopsBySection = {};
    matchedLoops.forEach(loop => {
      const [section, ...fieldParts] = loop.path.split('.');
      const field = fieldParts.join('.');
      
      if (!loopsBySection[section]) {
        loopsBySection[section] = [];
      }
      loopsBySection[section].push({
        field,
        fullPath: loop.path,
        open: loop.open.full,
        close: loop.close.full,
      });
    });
    
    // Check for image placeholders inside each loop
    console.log('='.repeat(80));
    console.log('Loop Analysis by Section:');
    console.log('='.repeat(80));
    console.log('');
    
    const issues = [];
    
    Object.keys(EXPECTED_FIELDS).forEach(section => {
      const expectedFields = EXPECTED_FIELDS[section];
      const foundLoops = loopsBySection[section] || [];
      const foundFields = foundLoops.map(l => l.field);
      
      console.log(`\n📁 ${section.toUpperCase()}:`);
      console.log(`   Expected fields: ${expectedFields.length}`);
      console.log(`   Found loops: ${foundLoops.length}`);
      
      // Check missing fields
      const missingFields = expectedFields.filter(f => !foundFields.includes(f));
      if (missingFields.length > 0) {
        console.log(`   ❌ Missing loops for: ${missingFields.join(', ')}`);
        issues.push({
          type: 'missing_loop',
          section,
          fields: missingFields,
        });
      }
      
      // Check each found loop
      foundLoops.forEach(loop => {
        const loopContent = xml.substring(
          matchedLoops.find(m => m.path === loop.fullPath).open.index,
          matchedLoops.find(m => m.path === loop.fullPath).close.index + 
          matchedLoops.find(m => m.path === loop.fullPath).close.full.length
        );
        
        // Check for image Alt Text
        const imageAltTextMatches = (loopContent.match(/descr=["']image["']/gi) || []).length;
        const imageTextMatches = (loopContent.match(/<w:t[^>]*>image<\/w:t>/gi) || []).length;
        
        console.log(`   ✅ ${loop.field}:`);
        console.log(`      - Image Alt Text="image": ${imageAltTextMatches}`);
        console.log(`      - "image" text nodes: ${imageTextMatches}`);
        
        if (imageAltTextMatches === 0) {
          console.log(`      ❌ PROBLEM: No image placeholder with Alt Text="image" found!`);
          issues.push({
            type: 'missing_image_placeholder',
            section,
            field: loop.field,
            path: loop.fullPath,
          });
        } else if (imageAltTextMatches > 1) {
          console.log(`      ⚠️  WARNING: Multiple image placeholders (${imageAltTextMatches}) - only first will be used`);
        }
        
        if (imageTextMatches > 0) {
          console.log(`      ⚠️  WARNING: Found "image" as text - should be a placeholder image instead`);
        }
      });
    });
    
    // Check for unexpected loops
    Object.keys(loopsBySection).forEach(section => {
      if (!EXPECTED_FIELDS[section]) {
        console.log(`\n⚠️  Unexpected section found: ${section}`);
        loopsBySection[section].forEach(loop => {
          console.log(`   - ${loop.field}`);
        });
      }
    });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log('');
    
    const totalExpected = Object.values(EXPECTED_FIELDS).reduce((sum, fields) => sum + fields.length, 0);
    const totalFound = matchedLoops.length;
    
    console.log(`Total expected loops: ${totalExpected}`);
    console.log(`Total found loops: ${totalFound}`);
    console.log(`Missing loops: ${totalExpected - totalFound}`);
    console.log('');
    
    if (unmatchedOpens.length > 0) {
      console.log(`❌ Unmatched opening loops: ${unmatchedOpens.length}`);
      unmatchedOpens.forEach(open => {
        console.log(`   - ${open.full}`);
      });
      console.log('');
    }
    
    if (unmatchedCloses.length > 0) {
      console.log(`❌ Unmatched closing loops: ${unmatchedCloses.length}`);
      unmatchedCloses.forEach(close => {
        console.log(`   - ${close.full}`);
      });
      console.log('');
    }
    
    if (issues.length > 0) {
      console.log(`❌ Issues found: ${issues.length}`);
      issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.type}:`);
        if (issue.type === 'missing_loop') {
          console.log(`   Section: ${issue.section}`);
          console.log(`   Missing fields: ${issue.fields.join(', ')}`);
        } else if (issue.type === 'missing_image_placeholder') {
          console.log(`   Section: ${issue.section}`);
          console.log(`   Field: ${issue.field}`);
          console.log(`   Path: ${issue.path}`);
        }
      });
    } else {
      console.log('✅ No issues found!');
    }
    
    // Generate copy-paste friendly report
    console.log('\n' + '='.repeat(80));
    console.log('COPY-PASTE FRIENDLY REPORT:');
    console.log('='.repeat(80));
    console.log('');
    
    console.log('FOUND LOOPS:');
    matchedLoops.forEach(loop => {
      const [section, ...fieldParts] = loop.path.split('.');
      const field = fieldParts.join('.');
      console.log(`✅ ${section}.${field}`);
    });
    console.log('');
    
    console.log('MISSING LOOPS:');
    Object.keys(EXPECTED_FIELDS).forEach(section => {
      const expectedFields = EXPECTED_FIELDS[section];
      const foundLoops = loopsBySection[section] || [];
      const foundFields = foundLoops.map(l => l.field);
      const missingFields = expectedFields.filter(f => !foundFields.includes(f));
      
      if (missingFields.length > 0) {
        missingFields.forEach(field => {
          console.log(`❌ ${section}.${field}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  analyzeAllLoops();
}

