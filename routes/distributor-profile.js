/**
 * Vajra Lock App — Distributor Self Profile Routes
 * GET /me — Fetch current logged-in distributor profile & credit balance
 */

const express = require('express');
const router = express.Router();

const Distributor = require('../models/Distributor');
const Shopkeeper = require('../models/Shopkeeper');
const { authenticate, authorizeDistributor } = require('../middleware/auth');

router.use(authenticate, authorizeDistributor);

// ─── GET /me — Fetch current distributor profile ──────────────────────
router.get('/me', async (req, res) => {
  try {
    const distributor = await Distributor.findById(req.user.id).select('-password');
    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: 'Distributor profile not found.',
        data: {},
      });
    }

    const shopkeeperCount = await Shopkeeper.countDocuments({
      distributorId: distributor.distributorId,
      isDeleted: { $ne: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Distributor profile retrieved.',
      data: {
        distributor: {
          ...distributor.toJSON(),
          shopkeeperCount,
        },
      },
    });
  } catch (error) {
    console.error('Fetch distributor profile error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching distributor profile.',
      data: {},
    });
  }
});

module.exports = router;
