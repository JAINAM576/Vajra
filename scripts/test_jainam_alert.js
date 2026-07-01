/**
 * Diagnostic script to test the updated alert image generator.
 * Generates an alert overlay image using the base wallpaper template (without shopkeeper info).
 */
require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { generateAndUploadAlertImage } = require('../utils/alertImage');

// Paths
const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');
const LOCAL_OUTPUT_PATH = path.join(__dirname, '..', 'images', 'jainam_alert_local.jpeg');
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\e3ff25d7-2940-48c3-b78d-8198465a1a42';
const ARTIFACT_OUTPUT_PATH = path.join(ARTIFACT_DIR, 'jainam_alert.jpeg');

async function run() {
  console.log('--- Generic Alert Image Generation Test ---');
  console.log('Template Path:', TEMPLATE_PATH);

  // 1. Generate Local Alert image overlay on top of wallpaper template
  console.log('\nStep 1: Generating local alert image layout...');
  const { buildAlertSvg } = require('../utils/alertImage');
  const buf = fs.readFileSync(TEMPLATE_PATH);
  const meta = await sharp(buf).metadata();
  console.log(`Template dimensions: ${meta.width}x${meta.height}`);

  // Generate standard bilingual alert message (null message triggers default note)
  const svg = buildAlertSvg(null, meta.width, meta.height);
  
  await sharp(buf)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(LOCAL_OUTPUT_PATH);
  
  console.log(`✅ Local alert image generated at: ${LOCAL_OUTPUT_PATH}`);

  // Copy to Artifact directory for the user to view in chat
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  fs.copyFileSync(LOCAL_OUTPUT_PATH, ARTIFACT_OUTPUT_PATH);
  console.log(`✅ Copied to artifact directory: ${ARTIFACT_OUTPUT_PATH}`);

  // 2. Generate and Upload to Cloudinary (generic single asset)
  console.log('\nStep 2: Uploading generic alert image to Cloudinary...');
  try {
    const url = await generateAndUploadAlertImage(null);
    console.log(`\n✅ SUCCESS! Cloudinary URL: ${url}`);
  } catch (err) {
    console.error(`\n❌ Cloudinary upload failed: ${err.message}`);
    console.error(err.stack);
  }
}

run().catch(console.error);
