/**
 * Vajra Lock App — Wallpaper Generator (v2 — reference-matched layout)
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

  <!-- ═══ ZONE 3: Below second divider (y=1190–1400) ═══ -->

  <text x="50%" y="1210" text-anchor="middle"
        font-size="27" font-weight="400" fill="rgba(255,255,255,0.72)"
        font-family="Arial, Helvetica, sans-serif">Contact Your Retailer</text>

  <text x="50%" y="1270" text-anchor="middle"
        font-size="${shopFontSize}" font-weight="800" fill="#FFFFFF"
        font-family="Arial, Helvetica, sans-serif">${safeShop}</text>

  <text x="50%" y="1320" text-anchor="middle"
        font-size="25" font-weight="400" fill="rgba(255,255,255,0.68)"
        font-family="Arial, Helvetica, sans-serif">Contact Info</text>

  <text x="50%" y="1370" text-anchor="middle"
        font-size="36" font-weight="600" fill="rgba(255,255,255,0.92)"
        font-family="Arial, Helvetica, sans-serif"
        letter-spacing="4">${safeMobile}</text>

</svg>
  `.trim());
}

module.exports = { buildOverlaySvg };
