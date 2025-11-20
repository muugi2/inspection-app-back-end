const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Analyze how placeholders are structured in the template
 */
async function analyzeTemplate(templatePath) {
  console.log('📖 Reading template:', templatePath);
  
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  
  const docXml = await zip.file('word/document.xml').async('string');
  console.log('Document.xml length:', docXml.length);
  
  // Extract all text content from text nodes
  const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const textNodes = [];
  let match;
  
  while ((match = textNodePattern.exec(docXml)) !== null) {
    textNodes.push({
      text: match[1],
      start: match.index,
      end: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  console.log(`\nTotal text nodes: ${textNodes.length}`);
  
  // Find text nodes that contain placeholder fragments
  const placeholderFragments = [];
  
  textNodes.forEach((node, index) => {
    const text = node.text;
    
    // Check if contains any placeholder-related characters
    if (text.includes('{{') || text.includes('}}') || 
        text.includes('d.') || 
        (text.includes('#') && textNodes[index - 1]?.text.includes('{{')) ||
        (text.includes('/') && textNodes[index - 1]?.text.includes('{{'))
    ) {
      placeholderFragments.push({
        index,
        text,
        hasOpen: text.includes('{{'),
        hasClose: text.includes('}}'),
        hasPath: text.includes('d.') || text.includes('#') || text.includes('/')
      });
    }
  });
  
  console.log(`\nNodes with placeholder content: ${placeholderFragments.length}`);
  
  // Analyze sequences
  console.log(`\n📋 Placeholder sequences:\n`);
  
  let inPlaceholder = false;
  let currentSequence = [];
  let sequences = [];
  
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    const text = node.text;
    
    if (text.includes('{{')) {
      inPlaceholder = true;
      currentSequence = [{ index: i, text }];
    } else if (inPlaceholder) {
      currentSequence.push({ index: i, text });
      
      if (text.includes('}}')) {
        inPlaceholder = false;
        sequences.push([...currentSequence]);
        currentSequence = [];
      }
    }
  }
  
  console.log(`Found ${sequences.length} placeholder sequences\n`);
  
  // Analyze each sequence
  sequences.forEach((seq, seqIndex) => {
    const combined = seq.map(n => n.text).join('');
    const nodeCount = seq.length;
    
    console.log(`${seqIndex + 1}. ${nodeCount} nodes: "${combined}"`);
    
    if (nodeCount > 1) {
      console.log(`   ⚠️ SPLIT ACROSS ${nodeCount} NODES:`);
      seq.forEach((node, i) => {
        console.log(`      [${node.index}] "${node.text}"`);
      });
    }
    
    console.log('');
  });
  
  // Check for incomplete placeholders
  if (inPlaceholder || currentSequence.length > 0) {
    console.log('⚠️ WARNING: Found incomplete placeholder sequence!');
    currentSequence.forEach(node => {
      console.log(`   [${node.index}] "${node.text}"`);
    });
  }
  
  // Find potential problems
  console.log('\n🔍 Potential issues:\n');
  
  let issues = [];
  
  sequences.forEach((seq, i) => {
    if (seq.length > 1) {
      issues.push(`Sequence ${i + 1} split across ${seq.length} nodes`);
    }
    
    const combined = seq.map(n => n.text).join('');
    const openCount = (combined.match(/\{\{/g) || []).length;
    const closeCount = (combined.match(/\}\}/g) || []).length;
    
    if (openCount !== closeCount) {
      issues.push(`Sequence ${i + 1} has unmatched delimiters: ${openCount} {{ vs ${closeCount} }}`);
    }
  });
  
  if (issues.length === 0) {
    console.log('✅ No obvious issues found in placeholder structure');
  } else {
    issues.forEach(issue => console.log(`   ❌ ${issue}`));
  }
  
  // Suggest fixes
  const splitSequences = sequences.filter(seq => seq.length > 1);
  
  if (splitSequences.length > 0) {
    console.log(`\n💡 Recommendation:`);
    console.log(`   ${splitSequences.length} placeholders are split across multiple text nodes.`);
    console.log(`   This can cause issues with template processing.`);
    console.log(`\n   Solutions:`);
    console.log(`   1. Manually fix in Word: Delete and retype each placeholder without formatting`);
    console.log(`   2. Use the merge script to automatically combine split nodes`);
  }
  
  return { sequences, splitSequences, textNodes };
}

// Run the script
const templatePath = process.argv[2] || path.join(__dirname, '..', 'templates', 'template.docx');

analyzeTemplate(templatePath)
  .then(() => {
    console.log('\n✅ Analysis completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });







