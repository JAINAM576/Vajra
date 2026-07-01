/**
 * Vajra Lock App — System Config Routes
 * GET    /              — Get platform config (public, no auth)
 * PUT    /              — Update config (admin only)
 * POST   /wallpapers    — Add wallpaper template (admin only)
 * DELETE /wallpapers/:index — Remove wallpaper template (admin only)
 * PUT    /qr            — Update payment QR URL (admin only)
 */

const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const Config = require('../models/SystemConfig');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

/**
 * Helper: Get or create the singleton platform config document.
 */
const getConfig = async () => {
  let config = await Config.findOne({ configKey: 'platform' });
  if (!config) {
    config = await Config.create({ configKey: 'platform' });
  }
  return config;
};

// ─── GET / — Get system config (Public — no auth) ────────────────────
router.get('/', async (req, res) => {
  try {
    const config = await getConfig();

    return res.status(200).json({
      success: true,
      message: 'Config retrieved successfully.',
      data: { config },
    });
  } catch (error) {
    console.error('Get config error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching config.',
      data: {},
    });
  }
});

// All routes below require admin auth
router.use(authenticate, authorizeAdmin);

// ─── PUT / — Update config fields ────────────────────────────────────
router.put('/', async (req, res) => {
  try {
    const allowedFields = [
      'creditPriceINR',
      'upiId',
      'maintenanceMode',
      'minAppVersion',
      'deviceOwnerQrUrl',
      'paymentQrUrl',
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update.',
        data: {},
      });
    }

    updates.updatedBy = req.user.id;

    const config = await Config.findOneAndUpdate(
      { configKey: 'platform' },
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Config updated successfully.',
      data: { config },
    });
  } catch (error) {
    console.error('Update config error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating config.',
      data: {},
    });
  }
});

// ─── POST /wallpapers — Add wallpaper template ───────────────────────
router.post('/wallpapers', async (req, res) => {
  try {
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: 'name and url are required.',
        data: {},
      });
    }

    const config = await Config.findOneAndUpdate(
      { configKey: 'platform' },
      {
        $push: { wallpaperTemplates: { name, url } },
        $set: { updatedBy: req.user.id },
      },
      { new: true, upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Wallpaper template added successfully.',
      data: { wallpaperTemplates: config.wallpaperTemplates },
    });
  } catch (error) {
    console.error('Add wallpaper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error adding wallpaper template.',
      data: {},
    });
  }
});

// ─── DELETE /wallpapers/:index — Remove wallpaper at array index ─────
router.delete('/wallpapers/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid non-negative index is required.',
        data: {},
      });
    }

    const config = await getConfig();

    if (!config.wallpaperTemplates || index >= config.wallpaperTemplates.length) {
      return res.status(404).json({
        success: false,
        message: 'Wallpaper template not found at the specified index.',
        data: {},
      });
    }

    config.wallpaperTemplates.splice(index, 1);
    config.updatedBy = req.user.id;
    await config.save();

    return res.status(200).json({
      success: true,
      message: 'Wallpaper template removed successfully.',
      data: { wallpaperTemplates: config.wallpaperTemplates },
    });
  } catch (error) {
    console.error('Remove wallpaper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error removing wallpaper template.',
      data: {},
    });
  }
});

// ─── PUT /qr — Update payment QR URL ─────────────────────────────────
router.put('/qr', async (req, res) => {
  try {
    const { paymentQrUrl } = req.body;

    if (!paymentQrUrl) {
      return res.status(400).json({
        success: false,
        message: 'paymentQrUrl is required.',
        data: {},
      });
    }

    const config = await Config.findOneAndUpdate(
      { configKey: 'platform' },
      {
        $set: {
          paymentQrUrl,
          updatedBy: req.user.id,
        },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Payment QR URL updated successfully.',
      data: { paymentQrUrl: config.paymentQrUrl },
    });
  } catch (error) {
    console.error('Update QR error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating QR URL.',
      data: {},
    });
  }
});

// ─── POST /upload — Upload base64 image to Cloudinary ────────────────
router.post('/upload', async (req, res) => {
  try {
    const { image, folder } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Base64 image string is required.',
        data: {},
      });
    }

    // Upload to Cloudinary (direct base64 support)
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: folder || 'lockapp_assets',
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded to Cloudinary successfully.',
      data: { url: uploadResponse.secure_url },
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image to Cloudinary.',
      error: error.message,
      data: {},
    });
  }
});

// ─── PUT /device-owner-qr — Update device owner app download QR URL ────
router.put('/device-owner-qr', async (req, res) => {
  try {
    const { deviceOwnerQrUrl } = req.body;

    if (!deviceOwnerQrUrl) {
      return res.status(400).json({
        success: false,
        message: 'deviceOwnerQrUrl is required.',
        data: {},
      });
    }

    const config = await Config.findOneAndUpdate(
      { configKey: 'platform' },
      {
        $set: {
          deviceOwnerQrUrl,
          updatedBy: req.user.id,
        },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Device owner QR URL updated successfully.',
      data: { deviceOwnerQrUrl: config.deviceOwnerQrUrl },
    });
  } catch (error) {
    console.error('Update device owner QR error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating device owner QR URL.',
      data: {},
    });
  }
});

module.exports = router;
