/**
 * Vajra Lock App — Shopkeeper Profile Routes (Shopkeeper Only)
 * GET  /               — Get own profile
 * PUT  /               — Update own profile
 * PUT  /wallpaper      — Update wallpaper URL
 * PUT  /notifications  — Update notification settings
 */

const express = require('express');
const router = express.Router();

const Shopkeeper = require('../models/Shopkeeper');
const { authenticate, authorizeShopkeeper } = require('../middleware/auth');

// All routes require shopkeeper auth
router.use(authenticate, authorizeShopkeeper);

// ─── GET / — Get own profile ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const shopkeeper = await Shopkeeper.findById(req.user.id).select('-password');

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully.',
      data: { shopkeeper },
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching profile.',
      data: {},
    });
  }
});

// ─── PUT / — Update own profile ──────────────────────────────────────
router.put('/', async (req, res) => {
  try {
    // Map profilePic from frontend to profilePicUrl in backend
    if (req.body.profilePic !== undefined) {
      req.body.profilePicUrl = req.body.profilePic;
    }

    // Only allow safe fields — mobileNo and credits are immutable by shopkeeper
    const allowedFields = ['shopkeeperName', 'shopName', 'location', 'gmail', 'profilePicUrl'];
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

    const shopkeeper = await Shopkeeper.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { shopkeeper },
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
      data: {},
    });
  }
});

// ─── PUT /wallpaper — Update wallpaper URL ───────────────────────────
router.put('/wallpaper', async (req, res) => {
  try {
    const { wallpaperUrl } = req.body;

    if (wallpaperUrl === undefined) {
      return res.status(400).json({
        success: false,
        message: 'wallpaperUrl is required.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findByIdAndUpdate(
      req.user.id,
      { $set: { wallpaperUrl } },
      { new: true }
    ).select('-password');

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallpaper updated successfully.',
      data: { wallpaperUrl: shopkeeper.wallpaperUrl },
    });
  } catch (error) {
    console.error('Update wallpaper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating wallpaper.',
      data: {},
    });
  }
});

// ─── PUT /notifications — Update notification settings ───────────────
router.put('/notifications', async (req, res) => {
  try {
    const { dashboardReminders, pushAlerts, whatsappAuto, smsAlerts } = req.body;

    const notificationSettings = {};

    if (dashboardReminders !== undefined)
      notificationSettings['notificationSettings.dashboardReminders'] = dashboardReminders;
    if (pushAlerts !== undefined)
      notificationSettings['notificationSettings.pushAlerts'] = pushAlerts;
    if (whatsappAuto !== undefined)
      notificationSettings['notificationSettings.whatsappAuto'] = whatsappAuto;
    if (smsAlerts !== undefined)
      notificationSettings['notificationSettings.smsAlerts'] = smsAlerts;

    if (Object.keys(notificationSettings).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one notification setting is required.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findByIdAndUpdate(
      req.user.id,
      { $set: notificationSettings },
      { new: true }
    ).select('-password');

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully.',
      data: { notificationSettings: shopkeeper.notificationSettings },
    });
  } catch (error) {
    console.error('Update notifications error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating notification settings.',
      data: {},
    });
  }
});

// ─── PUT /password — Update password (shopkeeper only) ────────────────
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required.',
        data: {},
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findById(req.user.id);
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    // Compare password
    const isMatch = await shopkeeper.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.',
        data: {},
      });
    }

    // Update password (triggers mongoose pre('save') hook)
    shopkeeper.password = newPassword;
    await shopkeeper.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      data: {},
    });
  } catch (error) {
    console.error('Update password error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating password.',
      data: {},
    });
  }
});

module.exports = router;
