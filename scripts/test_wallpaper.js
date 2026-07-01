/**
 * Quick test of wallpaper generation utility.
 * Usage: node scripts/test_wallpaper.js
 */
require('dotenv').config();
const { generateAndUploadWallpaper } = require('../utils/wallpaper');

async function test() {
  console.log('Testing wallpaper generation...');
  console.log('Cloudinary Config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? '***hidden***' : 'MISSING',
  });

  try {
    const url = await generateAndUploadWallpaper(
      'Parin Mobile Shop',
      '9876543210',
      'test_shopkeeper_001'
    );
    console.log('\n✅ SUCCESS! Wallpaper URL:', url);
  } catch (err) {
    console.error('\n❌ FAILED:', err.message);
    console.error(err.stack);
  }
}

test();
