/**
 * Vajra Lock App — Alert Image Generator
 * Generates a single, generic full-screen alert image by overlaying
 * the warning/alert note on the base wallpaper template (without shopkeeper info),
 * and uploads it to Cloudinary as a single generic resource.
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

// Configure Cloudinary
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
  console.log('[AlertImage] All fonts loaded successfully for path rendering');
} catch (err) {
  console.error('[AlertImage] Error loading fonts for path rendering:', err.message);
}

/**
 * Wraps text into lines of a maximum length to prevent visual overflow in SVG.
 */
function wrapText(text, maxChars = 30) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Builds the SVG overlay containing only the warning notes on top of the wallpaper template.
 */
function buildAlertSvg(alertMessage, width = 900, height = 1600) {
  const regularFont = latinRegular;
  const boldFont = latinBold || regularFont;
  const devRegularFont = devanagariRegular || regularFont;
  const devBoldFont = devanagariBold || devRegularFont || regularFont;

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // If a custom message is provided, display it wrapped.
  // Otherwise, display the default bilingual attention warning message.
  if (alertMessage) {
    const messageLines = wrapText(esc(alertMessage), 28);
    const messageStartLineY = 620;
    const lineSpacing = 55;
    
    // Draw ATTENTION header
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

    // Render message lines
    const messagePaths = messageLines.map((line, index) => {
      const y = messageStartLineY + index * lineSpacing;
      return regularFont.getPath(line, {
        x: 450,
        y: y,
        fontSize: 34,
        anchor: 'center middle',
        attributes: { fill: 'rgba(255,255,255,0.95)' }
      });
    }).join('\n');

    return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${attentionPath}
  ${attentionUnderline}
  ${messagePaths}
</svg>
    `.trim());
  }

  // Default bilingual EMI attention warning (Standard note layout matched to wallpaper design)
  const attentionPath = boldFont.getPath('ATTENTION', {
    x: 450,
    y: 460,
    fontSize: 60,
    anchor: 'center middle',
    attributes: { fill: '#FFFFFF' }
  });
  
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
</svg>
  `.trim());
}

/**
 * Generates the alert image from SVG template over base wallpaper and uploads to Cloudinary.
 * Since this is a generic alert, it uploads only once to a static path on Cloudinary.
 * 
 * @param {string} [alertMessage] - optional custom warning message
 * @returns {Promise<string>} - secure Cloudinary URL of the generic alert image
 */
async function generateAndUploadAlertImage(alertMessage) {
  // Read base wallpaper template
  const templateBuffer = await fs.promises.readFile(TEMPLATE_PATH);
  const metadata = await sharp(templateBuffer).metadata();
  const width = metadata.width || 900;
  const height = metadata.height || 1600;

  // Generate SVG overlay
  const svgOverlay = buildAlertSvg(alertMessage, width, height);

  // Composite the overlay on top of the wallpaper template
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

  const folder = 'vajra_alerts';
  const publicId = 'generic_alert';

  // Upload to Cloudinary
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        folder: folder,
        overwrite: true,
        invalidate: true,
        format: 'jpg',
      },
      (error, result) => {
        if (error) {
          console.error('[AlertImage] Cloudinary upload error:', error.message);
          return reject(error);
        }
        console.log(`[AlertImage] Uploaded successfully: ${result.secure_url}`);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(compositeBuffer);
  });
}

module.exports = { generateAndUploadAlertImage, buildAlertSvg };
