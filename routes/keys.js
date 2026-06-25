/**
 * Vajra Lock App — Activation Key Routes
 * GET    /          — List keys (role-scoped)
 * POST   /generate  — Generate key (shopkeeper)
 * POST   /add       — Admin add key for shopkeeper
 * DELETE /:key      — Revoke key
 */

const express = require('express');
const router = express.Router();

const ActivationKey = require('../models/ActivationKey');
const { authenticate, authorizeAdmin, authorizeShopkeeper } = require('../middleware/auth');
const { generateActivationKey } = require('../utils/helpers');

// All routes require authentication
router.use(authenticate);

// ─── GET / — List keys (role-scoped) ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { used } = req.query;

    const filter = {};

    // Scope to shopkeeper's own keys
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    // Filter by used status
    if (used !== undefined) {
      filter.isUsed = used === 'true';
    }

    const keys = await ActivationKey.find(filter)
      .populate('shopkeeperId', 'shopkeeperName shopName')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Activation keys retrieved successfully.',
      data: { keys, count: keys.length },
    });
  } catch (error) {
    console.error('List keys error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching activation keys.',
      data: {},
    });
  }
});

// ─── POST /generate — Generate key (Shopkeeper only) ─────────────────
router.post('/generate', authorizeShopkeeper, async (req, res) => {
  try {
    // Generate a unique key (retry on collision)
    let key;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 10) {
      key = generateActivationKey();
      exists = await ActivationKey.findOne({ key });
      attempts++;
    }

    if (exists) {
      return res.status(500).json({
        success: false,
        message: 'Could not generate a unique key. Please try again.',
        data: {},
      });
    }

    const activationKey = await ActivationKey.create({
      key,
      shopkeeperId: req.user.id,
      status: 'pending',
      isUsed: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Activation key generated successfully.',
      data: { activationKey },
    });
  } catch (error) {
    console.error('Generate key error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error generating key.',
      data: {},
    });
  }
});

// ─── POST /add — Admin add key for shopkeeper ────────────────────────
router.post('/add', authorizeAdmin, async (req, res) => {
  try {
    const { shopkeeperId, customKey } = req.body;

    if (!shopkeeperId || !customKey) {
      return res.status(400).json({
        success: false,
        message: 'shopkeeperId and customKey are required.',
        data: {},
      });
    }

    // Check for duplicate key
    const existing = await ActivationKey.findOne({ key: customKey });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This key already exists.',
        data: {},
      });
    }

    const activationKey = await ActivationKey.create({
      key: customKey,
      shopkeeperId,
      status: 'pending',
      isUsed: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Activation key added successfully.',
      data: { activationKey },
    });
  } catch (error) {
    console.error('Add key error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error adding key.',
      data: {},
    });
  }
});

// ─── DELETE /:key — Revoke key ───────────────────────────────────────
router.delete('/:key', async (req, res) => {
  try {
    const filter = { key: req.params.key };

    // Shopkeepers can only revoke their own keys
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const activationKey = await ActivationKey.findOne(filter);

    if (!activationKey) {
      return res.status(404).json({
        success: false,
        message: 'Activation key not found.',
        data: {},
      });
    }

    if (activationKey.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke a key that has already been used.',
        data: {},
      });
    }

    activationKey.status = 'revoked';
    activationKey.revokedAt = new Date();
    await activationKey.save();

    return res.status(200).json({
      success: true,
      message: 'Activation key revoked successfully.',
      data: { activationKey },
    });
  } catch (error) {
    console.error('Revoke key error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error revoking key.',
      data: {},
    });
  }
});

module.exports = router;
