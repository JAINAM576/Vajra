/**
 * Vajra Lock App — Wallpaper Generator
 * Generates a personalised lockscreen wallpaper by overlaying shopkeeper info
 * on the base template image, then uploads the result to Cloudinary.
 *
 * NOTE: Converts all text to SVG path outlines using pure JavaScript text-to-svg.
 * This guarantees identical rendering on any platform (Vercel, AWS Lambda, Docker, etc.)
 * without requiring system fonts or fontconfig.
 */

const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const TextToSVG = require('text-to-svg');

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// Load fonts at startup
let latinRegular, latinBold, devanagariRegular, devanagariBold;
try {
  latinRegular = TextToSVG.loadSync(path.join(FONTS_DIR, 'NotoSans-Regular.ttf'));
  latinBold = TextToSVG.loadSync(path.join(FONTS_DIR, 'NotoSans-Bold.ttf'));
  devanagariRegular = TextToSVG.loadSync(path.join(FONTS_DIR, 'NotoSansDevanagari-Regular.ttf'));
  devanagariBold = TextToSVG.loadSync(path.join(FONTS_DIR, 'NotoSansDevanagari-Bold.ttf'));
  console.log('[Wallpaper] All fonts loaded successfully for path rendering');
} catch (err) {
  console.error('[Wallpaper] Error loading fonts for path rendering:', err.message);
}

/**
 * Helper to render spaced letter outlines.
 */
function getPathWithLetterSpacing(textToSVG, text, options) {
  const { x, y, fontSize, letterSpacing, anchor = 'center middle', attributes = {} } = options;
  const chars = text.split('');
  const charMetrics = chars.map(c => textToSVG.getMetrics(c, { fontSize }));
  const totalWidth = charMetrics.reduce((sum, m) => sum + m.width, 0) + (chars.length - 1) * letterSpacing;
  
  let startX = x;
  if (anchor.includes('center')) {
    startX = x - totalWidth / 2;
  } else if (anchor.includes('right')) {
    startX = x - totalWidth;
  }
  
  const paths = [];
  let currentX = startX;
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const metrics = charMetrics[i];
    const charPath = textToSVG.getPath(char, {
      x: currentX,
      y: y,
      fontSize,
      anchor: 'left middle',
      attributes
    });
    paths.push(charPath);
    currentX += metrics.width + letterSpacing;
  }
  
  return paths.join('\n');
}

/**
 * Build an SVG with path overlays instead of text tags to guarantee portablity.
 */
function buildOverlaySvg(shopName, mobileNo, width = 900, height = 1600) {
  // Use regular fallback if bold fonts failed to load
  const regularFont = latinRegular;
  const boldFont = latinBold || regularFont;
  const devRegularFont = devanagariRegular || regularFont;
  const devBoldFont = devanagariBold || devRegularFont || regularFont;

  // --- Zone 1 Paths ---
  const attentionPath = boldFont.getPath('ATTENTION', {
    x: 450,
    y: 460,
    fontSize: 60,
    anchor: 'center middle',
    attributes: { fill: '#FFFFFF' }
  });
  
  // Calculate underline size for ATTENTION
  const attentionMetrics = boldFont.getMetrics('ATTENTION', { fontSize: 60 });
  const attentionWidth = attentionMetrics.width;
  const attentionUnderline = `<rect x="${450 - attentionWidth / 2}" y="495" width="${attentionWidth}" height="5" fill="#FFFFFF" />`;

  const dearCustomerPath = regularFont.getPath('Dear Customer,', {
    x: 450,
    y: 540,
    fontSize: 33,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.92)' }
  });

  const emiEnglish1Path = regularFont.getPath('Kindly pay your EMI before Due', {
    x: 450,
    y: 590,
    fontSize: 33,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.92)' }
  });

  const emiEnglish2Path = regularFont.getPath('date to avoid locking of your', {
    x: 450,
    y: 640,
    fontSize: 33,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.92)' }
  });

  const emiEnglish3Path = regularFont.getPath('device.', {
    x: 450,
    y: 690,
    fontSize: 33,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.92)' }
  });

  // --- Zone 2 Paths (Hindi) ---
  const emiHindi1Path = devBoldFont.getPath('कृपया अपने डिवाइस को लॉक होने से', {
    x: 450,
    y: 910,
    fontSize: 34,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.88)' }
  });

  const emiHindi2Path = devBoldFont.getPath('बचाने के लिए नियत तारीख से पहले', {
    x: 450,
    y: 970,
    fontSize: 34,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.88)' }
  });

  const emiHindi3Path = devBoldFont.getPath('अपनी किस्त का भुगतान करें।', {
    x: 450,
    y: 1030,
    fontSize: 34,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.88)' }
  });

  // --- Zone 3 Paths ---
  const contactRetailerPath = regularFont.getPath('Contact Your Retailer', {
    x: 450,
    y: 1210,
    fontSize: 27,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.72)' }
  });

  const upperShopName = String(shopName || '').toUpperCase();
  const shopFontSize = upperShopName.length > 24 ? 34 : upperShopName.length > 16 ? 40 : 48;
  const shopNamePath = boldFont.getPath(upperShopName, {
    x: 450,
    y: 1270,
    fontSize: shopFontSize,
    anchor: 'center middle',
    attributes: { fill: '#FFFFFF' }
  });

  const contactInfoLabelPath = regularFont.getPath('Contact Info', {
    x: 450,
    y: 1320,
    fontSize: 25,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.68)' }
  });

  const mobileNoPath = getPathWithLetterSpacing(boldFont, String(mobileNo || ''), {
    x: 450,
    y: 1370,
    fontSize: 36,
    letterSpacing: 8,
    anchor: 'center middle',
    attributes: { fill: 'rgba(255,255,255,0.92)' }
  });

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${attentionPath}
  ${attentionUnderline}
  ${dearCustomerPath}
  ${emiEnglish1Path}
  ${emiEnglish2Path}
  ${emiEnglish3Path}

  ${emiHindi1Path}
  ${emiHindi2Path}
  ${emiHindi3Path}

  ${contactRetailerPath}
  ${shopNamePath}
  ${contactInfoLabelPath}
  ${mobileNoPath}
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
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const metadata = await sharp(templateBuffer).metadata();
  const width = metadata.width || 900;
  const height = metadata.height || 1600;

  const svgOverlay = buildOverlaySvg(shopName, mobileNo, width, height);

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

  const oldPublicId = extractPublicId(oldWallpaperUrl);
  if (oldPublicId && oldPublicId !== fullNewPublicId) {
    try {
      console.log(`[Wallpaper] Deleting old wallpaper: ${oldPublicId}`);
      await cloudinary.uploader.destroy(oldPublicId, { invalidate: true });
    } catch (err) {
      console.error('[Wallpaper] Error deleting old wallpaper:', err.message);
    }
  }

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
