/**
 * Vajra Lock App — Alert Image Generator
 * Generates a single, generic full-screen alert image by overlaying
 * the warning/alert note on the base wallpaper template (without shopkeeper info),
 * and uploads it to Cloudinary as a single generic resource.
 */

const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TEMPLATE_PATH = path.join(__dirname, '..', 'images', 'wallpaper_image.jpeg');

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
    const messageTextsSvg = messageLines
      .map((line, index) => {
        const y = messageStartLineY + index * lineSpacing;
        return `<text x="50%" y="${y}" text-anchor="middle"
              font-size="34" font-weight="600" fill="rgba(255,255,255,0.95)"
              font-family="Arial, Helvetica, sans-serif">${line}</text>`;
      })
      .join('\n');

    return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <!-- ═══ ZONE 1: Header ═══ -->
  <text x="50%" y="460" text-anchor="middle"
        font-size="60" font-weight="900" fill="#FFFFFF"
        font-family="Arial, Helvetica, sans-serif"
        letter-spacing="8" text-decoration="underline">ATTENTION</text>

  <!-- ═══ ZONE 2: Custom Alert Message ═══ -->
  ${messageTextsSvg}
</svg>
    `.trim());
  }

  // Default bilingual EMI attention warning (Standard note layout matched to wallpaper design)
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <!-- ═══ ZONE 1: Above first divider (y=400–740) ═══ -->
  <text x="50%" y="460" text-anchor="middle"
        font-size="60" font-weight="900" fill="#FFFFFF"
        font-family="Arial, Helvetica, sans-serif"
        letter-spacing="8" text-decoration="underline">ATTENTION</text>

  <text x="50%" y="540" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif">Dear Customer,</text>

  <text x="50%" y="590" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif">Kindly pay your EMI before Due</text>

  <text x="50%" y="640" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif">date to avoid locking of your</text>

  <text x="50%" y="690" text-anchor="middle"
        font-size="33" font-weight="400" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif">device.</text>

  <!-- ═══ ZONE 2: Between dividers (y=820–1080) ═══ -->
  <text x="50%" y="910" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="Arial, Helvetica, sans-serif">कृपया अपने डिवाइस को लॉक होने से</text>

  <text x="50%" y="970" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="Arial, Helvetica, sans-serif">बचाने के लिए नियत तारीख से पहले</text>

  <text x="50%" y="1030" text-anchor="middle"
        font-size="34" font-weight="600" fill="rgba(255,255,255,0.88)"
        font-family="Arial, Helvetica, sans-serif">अपनी किस्त का भुगतान करें।</text>
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
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const metadata = await sharp(templateBuffer).metadata();
  const width = metadata.width || 900;
  const height = metadata.height || 1600;

  // Generate SVG overlay
  const svgOverlay = buildAlertSvg(alertMessage, width, height);

  // Composite the overlay on top of the wallpaper template
  const jpegBuffer = await sharp(templateBuffer)
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
    uploadStream.end(jpegBuffer);
  });
}

module.exports = { generateAndUploadAlertImage, buildAlertSvg };
