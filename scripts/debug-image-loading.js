/**
 * Debug script to test image loading and base64 conversion
 * Usage: node scripts/debug-image-loading.js <answerId>
 */

const { PrismaClient } = require('@prisma/client');
const { buildInspectionReportData } = require('../services/report-service');
const { loadImagePayload, resolveLocalPath, normalizeRelativePath } = require('../utils/imageStorage');

const prisma = new PrismaClient();

async function debugImageLoading(answerId) {
  try {
    console.log('='.repeat(80));
    console.log(`🔍 Debugging image loading for answer ID: ${answerId}`);
    console.log('='.repeat(80));
    console.log('');

    // Step 1: Get report data
    console.log('[1] Loading report data...');
    const reportData = await buildInspectionReportData(prisma, { answerId });
    console.log(`✅ Report data loaded: ${reportData.d?.images?.length || 0} images`);
    console.log('');

    // Step 2: Check each image
    const images = reportData.d?.images || [];
    if (images.length === 0) {
      console.log('⚠️  No images found for this answer');
      return;
    }

    console.log(`[2] Checking ${images.length} images...`);
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Image ${i + 1}/${images.length}:`);
      console.log(`  ID: ${image.id}`);
      console.log(`  Section: ${image.section}`);
      console.log(`  Field ID: ${image.fieldId}`);
      console.log(`  Storage Path: ${image.storagePath}`);
      console.log(`  Image URL: ${image.imageUrl}`);
      console.log(`  MIME Type: ${image.mimeType}`);
      console.log('');

      // Check base64
      if (!image.base64) {
        console.log('  ❌ Base64 is missing!');
        failCount++;
        
        // Try to reload
        console.log('  🔄 Attempting to reload image...');
        if (image.storagePath) {
          const normalizedPath = normalizeRelativePath(image.storagePath);
          console.log(`  Normalized path: ${normalizedPath}`);
          
          if (normalizedPath) {
            const localPath = resolveLocalPath(normalizedPath);
            console.log(`  Local path: ${localPath}`);
            
            if (localPath) {
              const payload = await loadImagePayload(normalizedPath);
              if (payload.base64) {
                console.log(`  ✅ Successfully reloaded! Base64 length: ${payload.base64.length}`);
                successCount++;
              } else {
                console.log(`  ❌ Reload failed: ${payload.error || 'Unknown error'}`);
                failCount++;
              }
            } else {
              console.log('  ❌ Failed to resolve local path');
              failCount++;
            }
          } else {
            console.log('  ❌ Failed to normalize path');
            failCount++;
          }
        } else {
          console.log('  ❌ No storage path available');
          failCount++;
        }
      } else {
        console.log(`  ✅ Base64 exists: ${image.base64.length} characters`);
        
        // Validate base64
        const base64Pattern = /^[A-Za-z0-9+/=]+$/;
        if (!base64Pattern.test(image.base64)) {
          console.log('  ❌ Base64 contains invalid characters!');
          console.log(`  First 100 chars: ${image.base64.substring(0, 100)}`);
          failCount++;
        } else {
          // Try to convert to buffer
          try {
            const buffer = Buffer.from(image.base64, 'base64');
            if (buffer.length === 0) {
              console.log('  ❌ Buffer is empty after conversion!');
              failCount++;
            } else {
              console.log(`  ✅ Buffer conversion successful: ${buffer.length} bytes`);
              successCount++;
            }
          } catch (bufferError) {
            console.log(`  ❌ Buffer conversion failed: ${bufferError.message}`);
            failCount++;
          }
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  Total: ${images.length}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Get answer ID from command line
const answerId = process.argv[2];

if (!answerId) {
  console.error('Usage: node scripts/debug-image-loading.js <answerId>');
  process.exit(1);
}

debugImageLoading(BigInt(answerId));







