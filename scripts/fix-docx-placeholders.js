const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const DOCUMENT_XML_RELATIVE_PATH = path.join(
  'templates',
  'template_extracted',
  'word',
  'document.xml'
);
const TEMPLATE_DIR_RELATIVE_PATH = path.join('templates', 'template_extracted');
const OUTPUT_DOCX_RELATIVE_PATH = path.join('templates', 'template.docx');
const INPUT_DOCX_RELATIVE_PATH = path.join('templates', 'template.docx');

const RUN_REGEX = /<w:r\b[\s\S]*?<\/w:r>/g;
const TEXT_REGEX = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

function extractRunText(runXml) {
  const matches = [...runXml.matchAll(TEXT_REGEX)];
  if (!matches.length) {
    return '';
  }
  return matches.map((m) => m[1] || '').join('');
}

function normalizePlaceholders(xml) {
  // First, fix triple braces {{{ -> {{ and }}} -> }}
  // This must happen BEFORE processing runs, as runs may contain split triple braces
  // Do multiple passes to handle nested cases like {{{{ -> {{
  let previousXml = '';
  while (xml !== previousXml) {
    previousXml = xml;
    xml = xml.replace(/\{\{\{/g, '{{');
    xml = xml.replace(/\}\}\}/g, '}}');
  }
  
  // Also fix in text nodes specifically - this is crucial for Word documents
  // Match any w:t tag with optional attributes and preserve them
  xml = xml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, text) => {
    let fixedText = text;
    // Keep fixing until no more changes (handle nested cases like {{{{ -> {{)
    let prevText = '';
    while (fixedText !== prevText) {
      prevText = fixedText;
      fixedText = fixedText.replace(/\{\{\{/g, '{{');
      fixedText = fixedText.replace(/\}\}\}/g, '}}');
    }
    // Preserve original attributes
    return `<w:t${attrs}>${fixedText}</w:t>`;
  });
  
  const runs = [...xml.matchAll(RUN_REGEX)];
  const replacements = [];

  let i = 0;
  while (i < runs.length) {
    const runMatch = runs[i];
    const runText = extractRunText(runMatch[0]);

    if (!runText.includes('{')) {
      i += 1;
      continue;
    }

    // Combine text from multiple runs if placeholder is split
    let combinedText = runText;
    let j = i + 1;

    while (!combinedText.includes('}}') && j < runs.length) {
      combinedText += extractRunText(runs[j][0]);
      j += 1;
    }

    if (!combinedText.includes('}}')) {
      i += 1;
      continue;
    }

    // Check if we have a complete placeholder
    const startPos = combinedText.indexOf('{{');
    const endPos = combinedText.indexOf('}}', startPos + 2);

    if (startPos === -1 || endPos === -1) {
      i = j;
      continue;
    }

    // Check if placeholder is split across runs
    const prefix = combinedText.slice(0, startPos).trim();
    const suffix = combinedText.slice(endPos + 2).trim();

    // If there's text before or after the placeholder, skip (might be intentional)
    if (prefix && !prefix.match(/^[^\w]*$/)) {
      i = j;
      continue;
    }
    if (suffix && !suffix.match(/^[^\w]*$/)) {
      i = j;
      continue;
    }

    // Extract placeholder content
    const content = combinedText
      .slice(startPos + 2, endPos)
      .trim();

    // Replace first run with complete placeholder
    const firstRun = runs[i];
    let firstRunXml = firstRun[0];
    
    // Find and replace the text node
    firstRunXml = firstRunXml.replace(
      /<w:t[^>]*>[\s\S]*?<\/w:t>/,
      `<w:t>{{${content}}}</w:t>`
    );

    replacements.push({
      start: firstRun.index,
      end: firstRun.index + firstRun[0].length,
      replacement: firstRunXml,
    });

    // Remove other runs that were part of this placeholder
    for (let k = i + 1; k < j; k += 1) {
      replacements.push({
        start: runs[k].index,
        end: runs[k].index + runs[k][0].length,
        replacement: '',
      });
    }

    i = j;
  }

  // Apply replacements in reverse order (to preserve indices)
  replacements.sort((a, b) => b.start - a.start);

  let output = xml;
  for (const { start, end, replacement } of replacements) {
    output = output.slice(0, start) + replacement + output.slice(end);
  }

  // Fix image Alt Text placeholders
  // Replace descr="{d.signatures.inspector}" or descr="{%d.signatures.inspector}" with descr="{{d.signatures.inspector}}"
  output = output.replace(/descr="\{d\.signatures\.inspector\}"/g, 'descr="{{d.signatures.inspector}}"');
  output = output.replace(/descr="\{%d\.signatures\.inspector\}"/g, 'descr="{{d.signatures.inspector}}"');
  
  // Fix image Alt Text placeholders for field images (descr="image")
  // Don't modify these - they should remain as "image"
  
  // Fix split placeholders that might still be in text nodes - be more careful
  // Only fix if they're clearly broken (missing opening/closing)
  
  // Fix triple opening braces {{{ -> {{ (multiple passes to handle nested cases)
  let previousOutput = '';
  while (output !== previousOutput) {
    previousOutput = output;
    output = output.replace(/\{\{\{/g, '{{');
    output = output.replace(/\}\}\}/g, '}}');
  }
  
  // Fix common broken placeholder patterns
  // Fix missing }} between placeholders like "{{placeholder1}{{placeholder2}}"
  // Pattern: {{text}{{text}} -> {{text}}{{text}}
  output = output.replace(/\{\{([^}]+)\}\{\{/g, '{{$1}}{{');
  
  // More specific fix for status/comment pairs like "{{d.field.status}{{d.field.comment}}"
  output = output.replace(/\{\{([^}]+\.status)\}\{\{/g, '{{$1}}{{');
  output = output.replace(/\{\{([^}]+\.comment)\}\{\{/g, '{{$1}}{{');
  
  // Fix missing {{ at the start like "{placeholder}}" 
  output = output.replace(/([^}])\{([^}]+)\}\}/g, '$1{{$2}}');
  
  // Fix missing }} at the end like "{{placeholder}"
  output = output.replace(/\{\{([^}]+)\}([^{])/g, '{{$1}}$2');

  // Verify all {{ have matching }}
  const openCount = (output.match(/\{\{/g) || []).length;
  const closeCount = (output.match(/\}\}/g) || []).length;
  
  if (openCount !== closeCount) {
    console.warn(`⚠️ Warning: After normalization, unmatched delimiters: ${openCount} {{ vs ${closeCount} }}`);
    
    // Try to find and fix broken placeholders in text nodes
    const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    const fixes = [];
    
    while ((textMatch = textNodePattern.exec(output)) !== null) {
      const fullMatch = textMatch[0];
      const textContent = textMatch[1];
      const openCount = (textContent.match(/\{\{/g) || []).length;
      const closeCount = (textContent.match(/\}\}/g) || []).length;
      
      if (openCount !== closeCount) {
        // Try to fix missing }} between placeholders
        let fixed = textContent.replace(/\{\{([^}]+)\}\{\{/g, '{{$1}}{{');
        
        if (fixed !== textContent) {
          const fixedFull = fullMatch.replace(textContent, fixed);
          fixes.push({ original: fullMatch, fixed: fixedFull });
        }
      }
    }
    
    // Apply fixes
    if (fixes.length > 0) {
      console.log(`  Attempting to fix ${fixes.length} broken text nodes...`);
      fixes.forEach(fix => {
        output = output.replace(fix.original, fix.fixed);
      });
      
      const finalOpenCount = (output.match(/\{\{/g) || []).length;
      const finalCloseCount = (output.match(/\}\}/g) || []).length;
      console.log(`  After fixes: ${finalOpenCount} {{ vs ${finalCloseCount} }}`);
    }
  }

  return output;
}

async function rebuildDocx(originalZip, extractedDirPath, outputDocxPath) {
  // Start with the original zip to preserve all files and structure
  const zip = new JSZip();
  
  // Copy all files from original zip (preserving structure)
  for (const [relativePath, file] of Object.entries(originalZip.files)) {
    if (file.dir) {
      zip.folder(relativePath);
    } else {
      // Skip duplicate word/word/ paths - we'll handle document.xml separately
      if (relativePath.includes('word/word/') && relativePath.includes('document.xml')) {
        continue; // Skip duplicate, we'll add correct one below
      }
      // Skip other bad paths
      if (relativePath.includes('word/_rels/word/_rels') || 
          relativePath.includes('word/word/word/')) {
        continue;
      }
      
      const content = await file.async('nodebuffer');
      zip.file(relativePath, content);
    }
  }
  
  // Now replace word/document.xml with the normalized version from extracted directory
  const normalizedDocXmlPath = path.join(extractedDirPath, 'word', 'document.xml');
  if (fs.existsSync(normalizedDocXmlPath)) {
    const normalizedContent = fs.readFileSync(normalizedDocXmlPath);
    zip.file('word/document.xml', normalizedContent);
    console.log('✅ Replaced word/document.xml with normalized version');
  }

  // Ensure _rels/.rels exists (required by easy-template-x)
  if (!zip.files['_rels/.rels']) {
    const relsPath = path.join(extractedDirPath, '_rels', '.rels');
    if (fs.existsSync(relsPath)) {
      const relsContent = fs.readFileSync(relsPath);
      zip.file('_rels/.rels', relsContent);
      console.log('✅ Added _rels/.rels from extracted directory');
    } else {
      // Create default _rels/.rels if it doesn't exist
      const defaultRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
      zip.file('_rels/.rels', defaultRels);
      console.log('✅ Created default _rels/.rels');
    }
  }
  
  // Verify required files exist
  if (!zip.files['word/document.xml']) {
    throw new Error('word/document.xml not found in rebuilt DOCX');
  }
  if (!zip.files['[Content_Types].xml']) {
    throw new Error('[Content_Types].xml not found in rebuilt DOCX');
  }
  
  console.log('✅ DOCX structure verified');

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9
    },
  });
  fs.writeFileSync(outputDocxPath, content);
}

async function main() {
  try {
    // Step 1: Extract DOCX
    const templatePath = path.join(process.cwd(), INPUT_DOCX_RELATIVE_PATH);
    const extractDir = path.join(process.cwd(), TEMPLATE_DIR_RELATIVE_PATH);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at ${templatePath}`);
    }

    console.log('Extracting DOCX...');
    const zip = await JSZip.loadAsync(fs.readFileSync(templatePath));
    
    // Create extraction directory
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    // Extract all files - normalize paths to use forward slashes
    // Track the actual document.xml location
    let actualDocXmlPath = null;
    
    for (const [relativePath, file] of Object.entries(zip.files)) {
      // Normalize path to use forward slashes
      let normalizedPath = relativePath.replace(/\\/g, '/');
      
      // Track if this is document.xml
      if (normalizedPath.endsWith('document.xml') && !normalizedPath.includes('_rels')) {
        actualDocXmlPath = normalizedPath;
      }
      
      // Fix duplicate word/word paths when extracting
      let extractPath = normalizedPath;
      // Replace word/word/... with word/... recursively
      while (extractPath.includes('word/word/')) {
        extractPath = extractPath.replace(/word\/word\//g, 'word/');
      }
      
      if (file.dir) {
        const dirPath = path.join(extractDir, extractPath);
        fs.mkdirSync(dirPath, { recursive: true });
      } else {
        const filePath = path.join(extractDir, extractPath);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const content = await file.async('nodebuffer');
        fs.writeFileSync(filePath, content);
      }
    }
    
    // If document.xml was in word/word/ location, copy it to word/ location
    if (actualDocXmlPath && actualDocXmlPath.includes('word/word/')) {
      const sourcePath = path.join(extractDir, actualDocXmlPath.replace(/\\/g, '/'));
      const targetPath = path.join(extractDir, 'word', 'document.xml');
      if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied ${actualDocXmlPath} to word/document.xml`);
      }
    }

    // Step 2: Normalize placeholders in document.xml
    // Try to find document.xml in various locations
    let documentXmlPath = path.join(extractDir, 'word', 'document.xml');
    if (!fs.existsSync(documentXmlPath)) {
      // Try alternative path
      documentXmlPath = path.join(extractDir, 'word', 'word', 'document.xml');
    }
    if (!fs.existsSync(documentXmlPath)) {
      // Search for document.xml
      const searchDir = path.join(extractDir, 'word');
      if (fs.existsSync(searchDir)) {
        const files = fs.readdirSync(searchDir, { recursive: true });
        const docXml = files.find(f => typeof f === 'string' && f.includes('document.xml'));
        if (docXml) {
          documentXmlPath = path.join(searchDir, docXml);
        }
      }
    }
    if (!fs.existsSync(documentXmlPath)) {
      throw new Error(`document.xml not found. Searched: ${path.join(extractDir, 'word', 'document.xml')}`);
    }
    
    console.log(`Found document.xml at: ${documentXmlPath}`);

    // Check if normalization is needed
    let xml = fs.readFileSync(documentXmlPath, 'utf8');
    
    // First check for triple braces - these must be fixed first
    const tripleOpenCount = (xml.match(/\{\{\{/g) || []).length;
    const tripleCloseCount = (xml.match(/\}\}\}/g) || []).length;
    
    if (tripleOpenCount > 0 || tripleCloseCount > 0) {
      console.warn(`⚠️ Warning: Found ${tripleOpenCount} {{{ and ${tripleCloseCount} }}} in template!`);
      console.warn('  Fixing triple braces first...');
      // Force normalization to fix triple braces
      xml = normalizePlaceholders(xml);
      fs.writeFileSync(documentXmlPath, xml, 'utf8');
      
      // Re-read and check again
      xml = fs.readFileSync(documentXmlPath, 'utf8');
    }
    
    const inputOpenCount = (xml.match(/\{\{/g) || []).length;
    const inputCloseCount = (xml.match(/\}\}/g) || []).length;
    
    if (inputOpenCount !== inputCloseCount) {
      console.warn(`⚠️ Warning: Template has unmatched delimiters: ${inputOpenCount} {{ vs ${inputCloseCount} }}`);
      console.warn('  Attempting to normalize...');
      xml = normalizePlaceholders(xml);
      
      const outputOpenCount = (xml.match(/\{\{/g) || []).length;
      const outputCloseCount = (xml.match(/\}\}/g) || []).length;
      
      if (outputOpenCount !== outputCloseCount) {
        console.error(`❌ ERROR: After normalization, still unmatched: ${outputOpenCount} {{ vs ${outputCloseCount} }}`);
        console.error('  Template may need manual fixing in Word');
      } else {
        console.log('✅ Placeholders normalized successfully');
      }
      fs.writeFileSync(documentXmlPath, xml, 'utf8');
    } else {
      console.log('✅ Template placeholders already balanced');
      console.log(`  Found ${inputOpenCount} placeholders`);
      
      // Even if balanced, check if there are actually placeholders
      if (inputOpenCount === 0) {
        console.warn('⚠️ WARNING: No placeholders found in template!');
        console.warn('  Template may need to be created in Word with placeholders');
        console.warn('  Or placeholders may be split across XML runs and need normalization');
        console.warn('  Attempting normalization anyway to fix split placeholders...');
        xml = normalizePlaceholders(xml);
        fs.writeFileSync(documentXmlPath, xml, 'utf8');
        
        const outputOpenCount = (xml.match(/\{\{/g) || []).length;
        const outputCloseCount = (xml.match(/\}\}/g) || []).length;
        console.log(`  After normalization: ${outputOpenCount} {{ and ${outputCloseCount} }}`);
      }
    }

    // Step 3: Rebuild DOCX (using original zip to preserve structure)
    const outputDocxPath = path.join(process.cwd(), OUTPUT_DOCX_RELATIVE_PATH);
    console.log('Rebuilding DOCX...');
    await rebuildDocx(zip, extractDir, outputDocxPath);
    console.log(`Template rebuilt: ${outputDocxPath}`);

    console.log('\n✅ Template placeholder normalization completed!');
  } catch (error) {
    console.error('Error normalizing template:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { normalizePlaceholders, rebuildDocx };

