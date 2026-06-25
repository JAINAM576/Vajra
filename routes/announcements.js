/**
 * Vajra Lock App — Announcement Routes
 * GET  /           — List announcements (role-scoped)
 * POST /           — Create announcement (admin only)
 * PUT  /:id/read   — Mark as read (shopkeeper only)
 */

const express = require('express');
const router = express.Router();

const Announcement = require('../models/Announcement');
const { authenticate, authorizeAdmin, authorizeShopkeeper } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ─── GET / — List announcements (role-scoped) ────────────────────────
router.get('/', async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'shopkeeper') {
      // Show announcements targeted to all OR specifically to this shopkeeper
      filter = {
        $or: [
          { targetType: 'all' },
          { targetShopkeeperIds: req.user.id },
        ],
      };
    }
    // Admin sees all (no filter)

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name adminId')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Announcements retrieved successfully.',
      data: { announcements, count: announcements.length },
    });
  } catch (error) {
    console.error('List announcements error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching announcements.',
      data: {},
    });
  }
});

// ─── POST / — Create announcement (Admin only) ──────────────────────
router.post('/', authorizeAdmin, async (req, res) => {
  try {
    const {
      title,
      body,
      type,
      targetType,
      targetShopkeeperIds,
      icon,
      color,
      bgColor,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'title and body are required.',
        data: {},
      });
    }

    const announcement = await Announcement.create({
      title,
      body,
      type: type || 'info',
      targetType: targetType || 'all',
      targetShopkeeperIds: targetShopkeeperIds || [],
      icon: icon || '',
      color: color || '',
      bgColor: bgColor || '',
      sentBy: req.user.id,
      readBy: [],
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully.',
      data: { announcement },
    });
  } catch (error) {
    console.error('Create announcement error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating announcement.',
      data: {},
    });
  }
});

// ─── PUT /:id/read — Mark as read (Shopkeeper only) ─────────────────
router.put('/:id/read', authorizeShopkeeper, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
        data: {},
      });
    }

    // Add to readBy if not already present (idempotent)
    const alreadyRead = announcement.readBy.some(
      (id) => id.toString() === req.user.id.toString()
    );

    if (!alreadyRead) {
      announcement.readBy.push(req.user.id);
      await announcement.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Announcement marked as read.',
      data: {},
    });
  } catch (error) {
    console.error('Mark read error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error marking announcement as read.',
      data: {},
    });
  }
});

module.exports = router;
