const { PrismaClient } = require('@prisma/client');
const { loadImagePayload } = require('../utils/imageStorage');

const prisma = new PrismaClient();

async function testLoadImagePayload() {
  try {
    console.log('='.repeat(80));
    console.log('Testing loadImagePayload function');
    console.log('='.repeat(80));
    console.log('');
    
    // Get a real image from database
    const answerId = 469; // Using the same answer ID from previous tests
    console.log(`Fetching images for answer ID: ${answerId}`);
    
    const rows = await prisma.$queryRaw`
      SELECT
        id,
        field_id,
        section,
        image_order,
        image_url,
        uploaded_at
      FROM inspection_question_images
      WHERE answer_id = ${answerId}
      ORDER BY section, field_id, image_order
      LIMIT 5;
    `;
    
    console.log(`Found ${rows.length} images in database\n`);
    
    if (rows.length === 0) {
      console.log('❌ No images found in database for answer ID:', answerId);
      console.log('   Please check if the answer ID is correct or if images exist.');
      return;
    }
    
    // Test each image
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      console.log(`${'='.repeat(80)}`);
      console.log(`Image ${i + 1}/${rows.length}:`);
      console.log(`${'='.repeat(80)}`);
      console.log(`  ID: ${row.id?.toString() || 'N/A'}`);
      console.log(`  Section: ${row.section || 'N/A'}`);
      console.log(`  Field ID: ${row.field_id || 'N/A'}`);
      console.log(`  Image Order: ${row.image_order || 'N/A'}`);
      console.log(`  Image URL: ${row.image_url || 'N/A'}`);
      console.log(`  Uploaded At: ${row.uploaded_at || 'N/A'}`);
      console.log('');
      
      if (!row.image_url) {
        console.log('  ⚠️  WARNING: Image URL is missing, skipping...\n');
        continue;
      }
      
      // Normalize path (same logic as in report-service.js)
      const { normalizeRelativePath } = require('../utils/imageStorage');
      const normalizedPath = normalizeRelativePath(row.image_url);
      
      console.log(`  Normalized Path: ${normalizedPath || 'N/A'}`);
      
      if (!normalizedPath) {
        console.log('  ❌ ERROR: Failed to normalize path');
        console.log('     Original URL:', row.image_url);
        console.log('');
        continue;
      }
      
      // Test loadImagePayload
      console.log('  Testing loadImagePayload...');
      const startTime = Date.now();
      
      try {
        const payload = await loadImagePayload(normalizedPath);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`  ✅ loadImagePayload completed in ${duration}ms`);
        console.log('');
        console.log('  Result:');
        console.log(`    Has base64: ${!!payload.base64}`);
        console.log(`    Base64 length: ${payload.base64?.length || 0} characters`);
        console.log(`    File size: ${payload.size || 0} bytes`);
        console.log(`    Local path: ${payload.localPath || 'N/A'}`);
        console.log(`    Error: ${payload.error || 'None'}`);
        
        if (payload.base64) {
          // Validate base64
          const base64Pattern = /^[A-Za-z0-9+/=]+$/;
          const isValidBase64 = base64Pattern.test(payload.base64);
          console.log(`    Base64 is valid: ${isValidBase64}`);
          
          // Estimate image size
          const estimatedSize = Math.ceil(payload.base64.length * 3 / 4);
          console.log(`    Estimated buffer size: ${estimatedSize} bytes`);
          
          // Check first few characters
          console.log(`    First 50 chars: ${payload.base64.substring(0, 50)}...`);
          
          // Try to create buffer
          try {
            const buffer = Buffer.from(payload.base64, 'base64');
            console.log(`    Buffer created: ${Buffer.isBuffer(buffer)}`);
            console.log(`    Buffer length: ${buffer.length} bytes`);
            
            // Check if buffer looks like an image (check magic bytes)
            const magicBytes = buffer.slice(0, 4);
            const magicHex = magicBytes.toString('hex');
            console.log(`    Magic bytes (hex): ${magicHex}`);
            
            // Common image magic bytes
            const imageTypes = {
              'ffd8ffe0': 'JPEG',
              'ffd8ffe1': 'JPEG',
              '89504e47': 'PNG',
              '47494638': 'GIF',
              '424d': 'BMP',
            };
            
            const detectedType = imageTypes[magicHex] || imageTypes[magicHex.substring(0, 4)] || 'Unknown';
            console.log(`    Detected image type: ${detectedType}`);
            
            if (detectedType === 'Unknown') {
              console.log(`    ⚠️  WARNING: Could not detect image type from magic bytes`);
            }
          } catch (bufferError) {
            console.log(`    ❌ ERROR: Failed to create buffer from base64`);
            console.log(`       Error: ${bufferError.message}`);
          }
        } else {
          console.log('    ❌ ERROR: No base64 data returned');
          if (payload.error) {
            console.log(`       Error message: ${payload.error}`);
          }
        }
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`  ❌ loadImagePayload failed after ${duration}ms`);
        console.log(`     Error: ${error.message}`);
        console.log(`     Stack: ${error.stack}`);
      }
      
      console.log('');
    }
    
    console.log('='.repeat(80));
    console.log('Summary:');
    console.log('='.repeat(80));
    console.log(`Total images tested: ${rows.length}`);
    
    // Test summary
    let successCount = 0;
    let failCount = 0;
    
    for (const row of rows) {
      if (!row.image_url) continue;
      const { normalizeRelativePath } = require('../utils/imageStorage');
      const normalizedPath = normalizeRelativePath(row.image_url);
      if (!normalizedPath) {
        failCount++;
        continue;
      }
      
      try {
        const payload = await loadImagePayload(normalizedPath);
        if (payload.base64) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }
    
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('');
    
    if (failCount === 0) {
      console.log('✅ All images loaded successfully!');
    } else {
      console.log(`⚠️  ${failCount} image(s) failed to load`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testLoadImagePayload();
}

module.exports = { testLoadImagePayload };

