/**
 * Quick diagnostic: Saves the generated wallpaper locally so we can check layout.
 */
require('dotenv').config();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');

async function analyzeTemplate() {
  const buf = fs.readFileSync(TEMPLATE_PATH);
  const meta = await sharp(buf).metadata();
  console.log('Template dimensions:', meta.width, 'x', meta.height);

  // Generate a test wallpaper locally (no Cloudinary)
  const { buildOverlaySvg } = require('./wallpaper_v2');
  const svg = buildOverlaySvg('SUNDHA MO BHILDI', '8140373732', meta.width, meta.height);
  
  const output = await sharp(buf)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(path.join(__dirname, '..', 'images', 'test_output.jpeg'));
  
  console.log('Saved test_output.jpeg -', output.width, 'x', output.height);
}

analyzeTemplate().catch(console.error);
