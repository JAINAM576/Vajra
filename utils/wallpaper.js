/**
 * Vajra Lock App — Wallpaper Generator
 * Generates a personalised lockscreen wallpaper by overlaying shopkeeper info
 * on the base template image, then uploads the result to Cloudinary.
 *
 * IMPORTANT: To support rendering fonts on all server environments (Docker, Render, etc.)
 * where system fonts are not installed, we dynamically configure fontconfig to search
 * our local bundled fonts directory.
 */

const path = require('path');
const fs = require('fs');

// ─── Setup custom Fontconfig to load local TTF files ─────────────────
const FONTS_DIR = path.join(__dirname, '..', 'fonts');
const FONTS_CONF_DIR = FONTS_DIR; // Keep fonts.conf in the fonts directory
const FONTS_CONF_PATH = path.join(FONTS_CONF_DIR, 'fonts.conf');

try {
  // Generate fonts.conf dynamically using the absolute path
  const fontsConfContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir prefix="default">${FONTS_DIR}</dir>
  <cachedir prefix="default">${path.join(FONTS_DIR, '.cache')}</cachedir>
</fontconfig>`;

  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }
  
  fs.writeFileSync(FONTS_CONF_PATH, fontsConfContent);
  process.env.FONTCONFIG_PATH = FONTS_CONF_DIR;
  console.log(`[Wallpaper] Fontconfig configured. FONTCONFIG_PATH set to: ${process.env.FONTCONFIG_PATH}`);
} catch (err) {
  console.error('[Wallpaper] Failed to configure local fontconfig:', err.message);
}

// Now load sharp and other dependencies
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');

// Font family string: Noto Sans (Latin) and Noto Sans Devanagari (Hindi)
const LATIN_FONT = "'Noto Sans', Arial, Helvetica, sans-serif";
const HINDI_FONT = "'Noto Sans Devanagari', 'Noto Sans', Arial, Helvetica, sans-serif";

/**
 * Build an SVG text overlay that matches the reference design exactly.
 *
 * Template (900×1600) has these fixed design elements:
 *   - Top area (y=0–380): Vajra logo, shield/lock icons, dot grids
 *   - First divider line with lock icon: ~y=770
 *   - Second divider line with lock icon: ~y=1140
 *   - Bottom area (y=1150–1600): Shield icon, dot grid, wave pattern
 *
 * Text placement zones (matching the reference image):
 *   ZONE 1 (y=400–740): "ATTENTION" + English EMI message
 *   ZONE 2 (y=820–1080): Hindi EMI message
 *   ZONE 3 (y=1190–1400): Contact Your Retailer / shop name / phone
 */
function buildOverlaySvg(shopName, mobileNo, width = 900, height = 1600) {
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const safeShop = esc(shopName).toUpperCase();
  const safeMobile = esc(mobileNo);

  // Dynamic font-size for long shop names
  const shopFontSize = safeShop.length > 24 ? 34 : safeShop.length > 16 ? 40 : 48;

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">

  <!-- ═══ ZONE 1: Above first divider (y=400–740) ═══ -->

  <text x="50%" y="460" text-anchor="middle"
        font-size="60" font-weight="900" fill="#FFFFFF"
        font-family="${LATIN_FONT}"
        letter-spacing="8" text-decoration="underline">ATTENTION</text>

  <text x="50%" y="540" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="${LATIN_FONT}">Dear Customer,</text>

  <text x="50%" y="590" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="${LATIN_FONT}">Kindly pay your EMI before Due</text>

  <text x="50%" y="640" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="${LATIN_FONT}">date to avoid locking of your</text>

  <text x="50%" y="690" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="${LATIN_FONT}">device.</text>

  <!-- ═══ ZONE 2: Between dividers (y=820–1080) ═══ -->

  <text x="50%" y="910" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="${HINDI_FONT}">कृपया अपने डिवाइस को लॉक होने से</text>

  <text x="50%" y="970" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="${HINDI_FONT}">बचाने के लिए नियत तारीख से पहले</text>

  <text x="50%" y="1030" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="${HINDI_FONT}">अपनी किस्त का भुगतान करें।</text>

  <!-- ═══ ZONE 3: Below second divider (y=1190–1400) ═══ -->

  <text x="50%" y="1210" text-anchor="middle"
        font-size="27" font-weight="400" fill="rgba(255,255,255,0.72)"
        font-family="${LATIN_FONT}">Contact Your Retailer</text>

  <text x="50%" y="1270" text-anchor="middle"
        font-size="${shopFontSize}" font-weight="800" fill="#FFFFFF"
        font-family="${LATIN_FONT}">${safeShop}</text>

  <text x="50%" y="1320" text-anchor="middle"
        font-size="25" font-weight="400" fill="rgba(255,255,255,0.68)"
        font-family="${LATIN_FONT}">Contact Info</text>

  <text x="50%" y="1370" text-anchor="middle"
        font-size="36" font-weight="600" fill="rgba(255,255,255,0.92)"
        font-family="${LATIN_FONT}"
        letter-spacing="4">${safeMobile}</text>

</svg>
  `.trim());
}

/**
 * Extract Cloudinary public ID from a secure URL.
 */
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('unsplash.com') || url.includes('images.unsplash.com')) return null;

  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    let pathPart = parts[1];
    const versionMatch = pathPart.match(/^v\d+\/(.+)$/);
    if (versionMatch) {
      pathPart = versionMatch[1];
    }

    const lastDotIdx = pathPart.lastIndexOf('.');
    if (lastDotIdx !== -1) {
      pathPart = pathPart.substring(0, lastDotIdx);
    }

    return pathPart;
  } catch (error) {
    console.error('[Wallpaper] Error parsing public ID from URL:', error.message);
    return null;
  }
}

/**
 * Generate a personalised wallpaper and upload to Cloudinary.
 *
 * @param {string} shopName
 * @param {string} mobileNo
 * @param {string} [shopkeeperId] — optional, used as public_id prefix
 * @param {string} [oldWallpaperUrl] — optional, used to clean up previous wallpapers
 * @returns {Promise<string>} — the Cloudinary secure URL
 */
async function generateAndUploadWallpaper(shopName, mobileNo, shopkeeperId, oldWallpaperUrl) {
  // Read template
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const metadata = await sharp(templateBuffer).metadata();
  const width = metadata.width || 900;
  const height = metadata.height || 1600;

  // Create SVG overlay
  const svgOverlay = buildOverlaySvg(shopName, mobileNo, width, height);

  // Composite the overlay on top of the template
  const compositeBuffer = await sharp(templateBuffer)
    .composite([
      {
        input: svgOverlay,
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();

  const newFolder = `vajra_wallpapers/shop_${shopkeeperId || 'unknown'}`;
  const newPublicId = 'wallpaper';
  const fullNewPublicId = `${newFolder}/${newPublicId}`;

  // If there was an old wallpaper, check and delete it if its public ID is different
  const oldPublicId = extractPublicId(oldWallpaperUrl);
  if (oldPublicId && oldPublicId !== fullNewPublicId) {
    try {
      console.log(`[Wallpaper] Deleting old wallpaper: ${oldPublicId}`);
      await cloudinary.uploader.destroy(oldPublicId, { invalidate: true });
    } catch (err) {
      console.error('[Wallpaper] Error deleting old wallpaper:', err.message);
    }
  }

  // Upload to Cloudinary folder-wise
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: newPublicId,
        resource_type: 'image',
        folder: newFolder,
        overwrite: true,
        invalidate: true,
        format: 'jpg',
      },
      (error, result) => {
        if (error) {
          console.error('[Wallpaper] Cloudinary upload error:', error.message);
          return reject(error);
        }
        console.log(`[Wallpaper] Uploaded successfully: ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(compositeBuffer);
  });
}

module.exports = { generateAndUploadWallpaper };
