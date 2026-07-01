/**
 * Diagnostic script to test wallpaper generation and Cloudinary upload.
 * Generates wallpaper for "jainam shop name" and "6252037146"
 */
require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { generateAndUploadWallpaper } = require('../utils/wallpaper');

// Paths
const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');
const LOCAL_OUTPUT_PATH = path.join(__dirname, '..', 'images', 'jainam_wallpaper_local.jpeg');
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e3ff25d7-2940-48c3-b78d-8198465a1a42';
const ARTIFACT_OUTPUT_PATH = path.join(ARTIFACT_DIR, 'jainam_wallpaper.jpeg');

async function run() {
  console.log('--- Wallpaper Generation Test ---');
  console.log('Shop Name: jainam shop name');
  console.log('Number: 6252037146');

  // Verify template exists
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Template not found at: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  // 1. Generate Local Wallpaper (equivalent to test_layout.js using scripts/wallpaper_v2)
  console.log('\nStep 1: Generating local wallpaper layout...');
  const { buildOverlaySvg } = require('./wallpaper_v2');
  const buf = fs.readFileSync(TEMPLATE_PATH);
  const meta = await sharp(buf).metadata();
  console.log(`Template metadata: ${meta.width}x${meta.height}`);

  const svg = buildOverlaySvg('jainam shop name', '6252037146', meta.width, meta.height);
  
  await sharp(buf)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(LOCAL_OUTPUT_PATH);
  
  console.log(`✅ Local wallpaper generated successfully at: ${LOCAL_OUTPUT_PATH}`);

  // Copy to Artifact directory for the user to view in chat
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  fs.copyFileSync(LOCAL_OUTPUT_PATH, ARTIFACT_OUTPUT_PATH);
  console.log(`✅ Copied to artifact directory: ${ARTIFACT_OUTPUT_PATH}`);

  // 2. Generate and Upload to Cloudinary using utils/wallpaper.js
  console.log('\nStep 2: Uploading generated wallpaper to Cloudinary...');
  try {
    const url = await generateAndUploadWallpaper(
      'jainam shop name',
      '6252037146',
      'jainam_test_shopkeeper'
    );
    console.log(`\n✅ SUCCESS! Cloudinary URL: ${url}`);
  } catch (err) {
    console.error(`\n❌ Cloudinary upload failed: ${err.message}`);
    console.error(err.stack);
  }
}

run().catch(console.error);
