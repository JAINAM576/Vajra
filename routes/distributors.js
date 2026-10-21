/**
 * Vajra Lock App — Distributor Management Routes (Super Admin Only)
 * GET    /              — List all distributors with stats
 * GET    /:id           — Get single distributor details
 * POST   /              — Create new distributor
 * PUT    /:id           — Update distributor details
 * PUT    /:id/credits   — Allocate credits to distributor
 * DELETE /:id           — Deactivate distributor
 */

const express = require('express');
const router = express.Router();

const Distributor = require('../models/Distributor');
const Shopkeeper = require('../models/Shopkeeper');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// All routes in this file are Super Admin only
router.use(authenticate, authorizeAdmin);

// ─── GET / — List all distributors ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const distributors = await Distributor.find().sort({ createdAt: -1 });

    const enriched = await Promise.all(
      distributors.map(async (dist) => {
        const shopkeeperCount = await Shopkeeper.countDocuments({
          distributorId: dist.distributorId,
          isDeleted: { $ne: true },
        });
        return {
          ...dist.toJSON(),
          shopkeeperCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Distributors retrieved successfully.',
      data: { distributors: enriched, count: enriched.length },
    });
  } catch (error) {
    console.error('List distributors error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching distributors.',
      data: {},
    });
  }
});

// ─── GET /:id — Get single distributor details ────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.params.id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found.',
        data: {},
      });
    }

    const shopkeeperCount = await Shopkeeper.countDocuments({
      distributorId: distributor.distributorId,
      isDeleted: { $ne: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Distributor retrieved successfully.',
      data: { distributor: { ...distributor.toJSON(), shopkeeperCount } },
    });
  } catch (error) {
    console.error('Get distributor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching distributor.',
      data: {},
    });
  }
});

// ─── POST / — Create new distributor ─────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { distributorId, name, area, mobileNo, password, androidCredits, appleCredits, iosCredits, credits } = req.body;

    if (!distributorId || !name || !mobileNo || !password) {
      return res.status(400).json({
        success: false,
        message: 'distributorId, name, mobileNo, and password are required.',
        data: {},
      });
    }

    const formattedId = distributorId.trim().toUpperCase();
    if (!/^[A-Z]{3}\d{3}$/.test(formattedId)) {
      return res.status(400).json({
        success: false,
        message: 'Distributor ID must be 6 characters (3 letters followed by 3 numbers, e.g. DIS101).',
        data: {},
      });
    }

    // Check duplicate ID
    const existingId = await Distributor.findOne({ distributorId: formattedId });
    if (existingId) {
      return res.status(400).json({
        success: false,
        message: `Distributor ID "${formattedId}" already exists.`,
        data: {},
      });
    }

    // Check duplicate mobile
    const existingMobile = await Distributor.findOne({ mobileNo: mobileNo.trim() });
    if (existingMobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is already registered for a distributor.',
        data: {},
      });
    }

    let aCredits = typeof androidCredits === 'number' ? androidCredits : 0;
    let iCredits = typeof iosCredits === 'number' ? iosCredits : (typeof appleCredits === 'number' ? appleCredits : 0);
    
    if (aCredits === 0 && iCredits === 0 && typeof credits === 'number') {
      aCredits = credits;
    }

    const distributor = await Distributor.create({
      distributorId: formattedId,
      name: name.trim(),
      area: area ? area.trim() : '',
      mobileNo: mobileNo.trim(),
      password,
      androidCredits: aCredits,
      iosCredits: iCredits,
      credits: aCredits + iCredits,
    });

    return res.status(201).json({
      success: true,
      message: 'Distributor created successfully.',
      data: { distributor: distributor.toJSON() },
    });
  } catch (error) {
    console.error('Create distributor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating distributor.',
      data: {},
    });
  }
});

// ─── PUT /:id/credits — Add/Deduct distributor credits ───────────────
router.put('/:id/credits', async (req, res) => {
  try {
    const { amount, platform } = req.body;
    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-zero numeric amount is required.',
        data: {},
      });
    }

    const targetPlatform = (platform === 'ios' || platform === 'apple') ? 'ios' : 'android';

    const distributor = await Distributor.findById(req.params.id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found.',
        data: {},
      });
    }

    if (targetPlatform === 'ios') {
      distributor.iosCredits = (distributor.iosCredits || 0) + amount;
      if (distributor.iosCredits < 0) distributor.iosCredits = 0;
    } else {
      distributor.androidCredits = (distributor.androidCredits || 0) + amount;
      if (distributor.androidCredits < 0) distributor.androidCredits = 0;
    }
    distributor.credits = (distributor.androidCredits || 0) + (distributor.iosCredits || 0);

    await distributor.save();

    return res.status(200).json({
      success: true,
      message: `Distributor ${targetPlatform} credits updated. New total balance: ${distributor.credits}`,
      data: { distributor: distributor.toJSON() },
    });
  } catch (error) {
    console.error('Update distributor credits error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating distributor credits.',
      data: {},
    });
  }
});

// ─── PUT /:id — Update distributor details ───────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['name', 'area', 'mobileNo', 'isActive'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const distributor = await Distributor.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Distributor updated successfully.',
      data: { distributor },
    });
  } catch (error) {
    console.error('Update distributor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating distributor.',
      data: {},
    });
  }
});

// ─── DELETE /:id — Toggle active status / deactivate distributor ──────
router.delete('/:id', async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.params.id);
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor not found.',
        data: {},
      });
    }

    distributor.isActive = false;
    await distributor.save();

    return res.status(200).json({
      success: true,
      message: 'Distributor account deactivated successfully.',
      data: {},
    });
  } catch (error) {
    console.error('Deactivate distributor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error deactivating distributor.',
      data: {},
    });
  }
});

module.exports = router;
