/**
 * Vajra Lock App — Wallpaper Generator
 * Generates a personalised lockscreen wallpaper by overlaying shopkeeper info
 * on the base template image, then uploads the result to Cloudinary.
 *
 * IMPORTANT: Fonts are embedded as base64 @font-face inside the SVG so that
 * text renders correctly on ANY server (Docker, Render, Railway, etc.)
 * regardless of whether system fonts are installed.
 */

const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');

// ─── Load and cache font data as base64 at startup ───────────────────
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

let notoSansBase64 = '';
let notoSansDevanagariBase64 = '';

try {
  const notoSansPath = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
  if (fs.existsSync(notoSansPath)) {
    notoSansBase64 = fs.readFileSync(notoSansPath).toString('base64');
    console.log('[Wallpaper] NotoSans font loaded successfully');
  } else {
    console.warn('[Wallpaper] NotoSans-Regular.ttf not found in fonts/');
  }
} catch (err) {
  console.error('[Wallpaper] Error loading NotoSans font:', err.message);
}

try {
  const devanagariPath = path.join(FONTS_DIR, 'NotoSansDevanagari-Regular.ttf');
  if (fs.existsSync(devanagariPath)) {
    notoSansDevanagariBase64 = fs.readFileSync(devanagariPath).toString('base64');
    console.log('[Wallpaper] NotoSansDevanagari font loaded successfully');
  } else {
    console.warn('[Wallpaper] NotoSansDevanagari-Regular.ttf not found in fonts/');
  }
} catch (err) {
  console.error('[Wallpaper] Error loading NotoSansDevanagari font:', err.message);
}

/**
 * Build the @font-face CSS block that embeds fonts directly into the SVG.
 * This ensures text renders on servers without system fonts.
 */
function buildFontFaceCSS() {
  let css = '';

  if (notoSansBase64) {
    css += `
      @font-face {
        font-family: 'NotoSans';
        src: url('data:font/truetype;base64,${notoSansBase64}') format('truetype');
        font-weight: 100 900;
        font-style: normal;
      }
    `;
  }

  if (notoSansDevanagariBase64) {
    css += `
      @font-face {
        font-family: 'NotoSansDevanagari';
        src: url('data:font/truetype;base64,${notoSansDevanagariBase64}') format('truetype');
        font-weight: 100 900;
        font-style: normal;
      }
    `;
  }

  return css;
}

// Font family string: use embedded fonts with system fallbacks
const LATIN_FONT = notoSansBase64
  ? "'NotoSans', Arial, Helvetica, sans-serif"
  : "Arial, Helvetica, sans-serif";

const HINDI_FONT = notoSansDevanagariBase64
  ? "'NotoSansDevanagari', 'NotoSans', Arial, Helvetica, sans-serif"
  : "'NotoSans', Arial, Helvetica, sans-serif";

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

  const fontFaceCSS = buildFontFaceCSS();

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">

  <defs>
    <style type="text/css">
      ${fontFaceCSS}
    </style>
  </defs>

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
