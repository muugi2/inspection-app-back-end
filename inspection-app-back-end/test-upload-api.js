/**
 * Test script for Upload API
 * 
 * This script tests the /api/upload endpoint
 * 
 * Usage:
 *   1. Make sure the server is running (npm start)
 *   2. Update JWT_TOKEN with a valid token
 *   3. Update USER_ID with a valid user ID from your database
 *   4. Place test images in the same directory as this script
 *   5. Run: node test-upload-api.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:4555';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual JWT token
const USER_ID = '1'; // Replace with actual user ID

// Test images (create dummy images if they don't exist)
const TEST_IMAGE_1 = path.join(__dirname, 'test-image-1.jpg');
const TEST_IMAGE_2 = path.join(__dirname, 'test-image-2.png');

/**
 * Create a dummy test image if it doesn't exist
 */
function createDummyImage(filePath) {
  if (!fs.existsSync(filePath)) {
    // Create a simple 1x1 pixel PNG
    const pngData = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(filePath, pngData);
    console.log(`✅ Created dummy image: ${filePath}`);
  }
}

/**
 * Test 1: Upload with no images (should succeed with empty array)
 */
async function test1_NoImages() {
  console.log('\n=== TEST 1: Upload with No Images ===');
  
  try {
    const formData = new FormData();
    formData.append('userId', USER_ID);
    
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ Success:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.uploaded.length === 0) {
      console.log('✅ TEST PASSED');
    } else {
      console.log('❌ TEST FAILED: Expected empty array');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('❌ TEST FAILED');
  }
}

/**
 * Test 2: Upload with single image
 */
async function test2_SingleImage() {
  console.log('\n=== TEST 2: Upload with Single Image ===');
  
  try {
    createDummyImage(TEST_IMAGE_1);
    
    const formData = new FormData();
    formData.append('userId', USER_ID);
    formData.append('images', fs.createReadStream(TEST_IMAGE_1));
    
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ Success:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.uploaded.length === 1) {
      console.log('✅ TEST PASSED');
      console.log('Uploaded URL:', response.data.uploaded[0]);
    } else {
      console.log('❌ TEST FAILED: Expected 1 uploaded URL');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('❌ TEST FAILED');
  }
}

/**
 * Test 3: Upload with multiple images
 */
async function test3_MultipleImages() {
  console.log('\n=== TEST 3: Upload with Multiple Images ===');
  
  try {
    createDummyImage(TEST_IMAGE_1);
    createDummyImage(TEST_IMAGE_2);
    
    const formData = new FormData();
    formData.append('userId', USER_ID);
    formData.append('images', fs.createReadStream(TEST_IMAGE_1));
    formData.append('images', fs.createReadStream(TEST_IMAGE_2));
    
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ Success:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.uploaded.length === 2) {
      console.log('✅ TEST PASSED');
      console.log('Uploaded URLs:', response.data.uploaded);
    } else {
      console.log('❌ TEST FAILED: Expected 2 uploaded URLs');
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.log('❌ TEST FAILED');
  }
}

/**
 * Test 4: Upload without userId (should fail)
 */
async function test4_MissingUserId() {
  console.log('\n=== TEST 4: Upload without userId (Should Fail) ===');
  
  try {
    createDummyImage(TEST_IMAGE_1);
    
    const formData = new FormData();
    // Don't append userId
    formData.append('images', fs.createReadStream(TEST_IMAGE_1));
    
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('❌ TEST FAILED: Should have returned error');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error) {
      console.log('✅ Correctly returned error:');
      console.log(JSON.stringify(error.response.data, null, 2));
      console.log('✅ TEST PASSED');
    } else {
      console.error('❌ Unexpected error:', error.message);
      console.log('❌ TEST FAILED');
    }
  }
}

/**
 * Test 5: Upload without authentication (should fail)
 */
async function test5_NoAuth() {
  console.log('\n=== TEST 5: Upload without Authentication (Should Fail) ===');
  
  try {
    const formData = new FormData();
    formData.append('userId', USER_ID);
    
    const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
      headers: {
        // No Authorization header
        ...formData.getHeaders()
      }
    });
    
    console.log('❌ TEST FAILED: Should have returned 401 error');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly returned 401 Unauthorized');
      console.log('✅ TEST PASSED');
    } else {
      console.error('❌ Unexpected error:', error.message);
      console.log('❌ TEST FAILED');
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         UPLOAD API TEST SUITE                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\nAPI Base URL: ${API_BASE_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`JWT Token: ${JWT_TOKEN.substring(0, 20)}...`);
  
  // Check if JWT token is set
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.error('\n❌ ERROR: Please set JWT_TOKEN in the script before running tests');
    console.log('\nTo get a JWT token:');
    console.log('1. Start the server: npm start');
    console.log('2. Login via /api/auth/login endpoint');
    console.log('3. Copy the JWT token from the response');
    console.log('4. Update JWT_TOKEN variable in this script');
    return;
  }
  
  try {
    await test1_NoImages();
    await test2_SingleImage();
    await test3_MultipleImages();
    await test4_MissingUserId();
    await test5_NoAuth();
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║         ALL TESTS COMPLETED                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  }
}

// Run tests
runTests();



