/**
 * Preview API шалгах скрипт
 * 
 * Энэ скрипт нь:
 * 1. Auth token авах (login)
 * 2. Preview API дуудах
 * 3. d.images массивт base64 зургууд байгаа эсэхийг шалгах
 * 
 * Ашиглах:
 *   node scripts/test-preview-api.js <answerId> [email] [password]
 * 
 * Жишээ:
 *   node scripts/test-preview-api.js 1
 *   node scripts/test-preview-api.js 1 user@example.com password123
 */

const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from config.env
const configPath = path.join(__dirname, '..', 'config.env');
if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
}

// Get port from environment or config, default to 4555
// Note: Backend Express server runs on port 4555 (from config.env)
// Next.js app runs on port 3000, but Backend API is on 4555
const PORT = process.env.PORT || 4555;
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:4555/api`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Get user input
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// Step 1: Login and get token
async function login(email, password) {
  logSection('STEP 1: Authentication');
  
  try {
    logInfo(`API Base URL: ${API_BASE_URL}`);
    logInfo(`Logging in as: ${email}`);
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });

    if (response.data && response.data.data && response.data.data.token) {
      const token = response.data.data.token;
      logSuccess('Login successful!');
      logInfo(`Token received: ${token.substring(0, 20)}...`);
      return token;
    } else {
      logError('Login response missing token');
      throw new Error('Invalid login response');
    }
  } catch (error) {
    if (error.response) {
      logError(`Login failed: ${error.response.status} ${error.response.statusText}`);
      
      // Check if response is HTML (Next.js 404 page)
      const contentType = error.response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        logError('⚠️  Received HTML response instead of JSON!');
        logError('This usually means:');
        logError('  1. Backend server is not running on the expected port');
        logError(`  2. URL is incorrect: ${API_BASE_URL}/auth/login`);
        logError('  3. Next.js app is intercepting the request');
        logWarning(`\n💡 Try checking:`);
        logWarning(`  - Is backend server running? Check port ${PORT}`);
        logWarning(`  - Is API_BASE_URL correct? Current: ${API_BASE_URL}`);
        logWarning(`  - Try: curl ${API_BASE_URL}/auth/login`);
      } else if (error.response.data) {
        // Try to parse as JSON
        try {
          if (typeof error.response.data === 'string') {
            logError(`Error response: ${error.response.data.substring(0, 200)}...`);
          } else {
            logError(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
          }
        } catch (e) {
          logError(`Error response (non-JSON): ${String(error.response.data).substring(0, 200)}`);
        }
      }
    } else if (error.request) {
      logError('❌ No response from server!');
      logError('Possible issues:');
      logError(`  1. Backend server is not running on port ${PORT}`);
      logError(`  2. Server URL is incorrect: ${API_BASE_URL}`);
      logError(`  3. Firewall is blocking the connection`);
      logWarning(`\n💡 Try:`);
      logWarning(`  - Check if server is running: curl http://localhost:${PORT}/health`);
      logWarning(`  - Check config.env for PORT setting`);
    } else {
      logError(`Login error: ${error.message}`);
    }
    throw error;
  }
}

// Step 2: Call Preview API
async function getPreview(answerId, token) {
  logSection('STEP 2: Calling Preview API');
  
  try {
    const url = `${API_BASE_URL}/documents/answers/${answerId}/preview`;
    logInfo(`Request URL: ${url}`);
    logInfo(`Answer ID: ${answerId}`);
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    logSuccess('Preview API call successful!');
    return response.data;
  } catch (error) {
    if (error.response) {
      logError(`Preview API failed: ${error.response.status} ${error.response.statusText}`);
      if (error.response.data) {
        logError(`Error details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    } else if (error.request) {
      logError('No response from server');
    } else {
      logError(`Preview API error: ${error.message}`);
    }
    throw error;
  }
}

// Step 3: Analyze images in response
function analyzeImages(data) {
  logSection('STEP 3: Analyzing Images');

  if (!data || !data.data) {
    logError('Invalid response structure: missing data field');
    return;
  }

  const reportData = data.data;
  
  if (!reportData.d) {
    logError('Invalid response structure: missing d field');
    return;
  }

  const images = reportData.d.images || [];
  logInfo(`Total images found: ${images.length}`);

  if (images.length === 0) {
    logWarning('⚠️  No images found in response!');
    logWarning('This could mean:');
    logWarning('  - No images were uploaded for this answer');
    logWarning('  - Images failed to load from FTP storage');
    logWarning('  - Database has no image records for this answer');
    return;
  }

  // Group images by status
  const withBase64 = images.filter(img => img.base64 && img.base64.length > 0);
  const withoutBase64 = images.filter(img => !img.base64 || img.base64.length === 0);

  logSuccess(`Images with base64: ${withBase64.length}`);
  if (withoutBase64.length > 0) {
    logError(`Images without base64: ${withoutBase64.length}`);
  }

  // Analyze each image
  console.log('\n📊 Image Details:');
  console.log('-'.repeat(60));
  
  images.forEach((img, index) => {
    const hasBase64 = img.base64 && img.base64.length > 0;
    const status = hasBase64 ? '✅' : '❌';
    
    console.log(`\n${status} Image ${index + 1}:`);
    console.log(`   ID: ${img.id || 'N/A'}`);
    console.log(`   Section: ${img.section || 'N/A'}`);
    console.log(`   Field ID: ${img.fieldId || 'N/A'}`);
    console.log(`   Order: ${img.order || 0}`);
    console.log(`   Image URL: ${img.imageUrl || 'N/A'}`);
    console.log(`   Storage Path: ${img.storagePath || 'N/A'}`);
    console.log(`   MIME Type: ${img.mimeType || 'N/A'}`);
    console.log(`   Base64: ${hasBase64 ? `✅ Present (${img.base64.length} chars)` : '❌ Missing'}`);
    
    if (hasBase64) {
      // Validate base64 format
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      const isValid = base64Pattern.test(img.base64);
      console.log(`   Base64 Valid: ${isValid ? '✅' : '❌'}`);
      
      // Estimate image size
      const estimatedSize = Math.ceil(img.base64.length * 3 / 4);
      console.log(`   Estimated Size: ~${(estimatedSize / 1024).toFixed(2)} KB`);
    } else {
      logWarning(`   ⚠️  This image will NOT appear in DOCX file!`);
    }
  });

  // Summary by section
  console.log('\n📁 Images by Section:');
  console.log('-'.repeat(60));
  const bySection = {};
  images.forEach(img => {
    const section = img.section || 'unknown';
    if (!bySection[section]) {
      bySection[section] = { total: 0, withBase64: 0 };
    }
    bySection[section].total++;
    if (img.base64 && img.base64.length > 0) {
      bySection[section].withBase64++;
    }
  });

  Object.entries(bySection).forEach(([section, stats]) => {
    const status = stats.withBase64 === stats.total ? '✅' : '⚠️';
    console.log(`${status} ${section}: ${stats.withBase64}/${stats.total} with base64`);
  });

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (withBase64.length === images.length) {
    logSuccess('🎉 ALL IMAGES HAVE BASE64 - Ready for DOCX generation!');
  } else {
    logError(`⚠️  ${withoutBase64.length} IMAGE(S) MISSING BASE64 - DOCX will have broken images!`);
    logWarning('Check server logs for image loading errors');
    logWarning('Verify FTP storage path and file existence');
  }
  console.log('='.repeat(60));
}

// Main function
async function main() {
  console.log('\n');
  log('🔍 Preview API Image Checker', 'cyan');
  log('='.repeat(60), 'cyan');
  logInfo(`Using API Base URL: ${API_BASE_URL}`);
  logInfo(`Port from config: ${PORT}`);
  console.log('');
  
  // Get answer ID
  const answerId = process.argv[2];
  if (!answerId) {
    logError('Answer ID is required!');
    console.log('\nUsage:');
    console.log('  node scripts/test-preview-api.js <answerId> [email] [password]');
    console.log('\nExample:');
    console.log('  node scripts/test-preview-api.js 1');
    console.log('  node scripts/test-preview-api.js 1 user@example.com password123');
    process.exit(1);
  }

  // Get credentials
  let email = process.argv[3];
  let password = process.argv[4];

  if (!email) {
    email = await askQuestion('Enter email: ');
  }

  if (!password) {
    password = await askQuestion('Enter password: ');
  }

  try {
    // Step 1: Login
    const token = await login(email, password);

    // Step 2: Get preview
    const previewData = await getPreview(answerId, token);

    // Step 3: Analyze images
    analyzeImages(previewData);

    // Optionally save response to file
    const fs = require('fs');
    const outputFile = `preview-response-${answerId}-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(previewData, null, 2));
    logInfo(`\nFull response saved to: ${outputFile}`);

  } catch (error) {
    logError('\n❌ Test failed!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { login, getPreview, analyzeImages };

