/**
 * Vajra Lock App — Shopkeeper Management Routes (Admin Only)
 * GET    /              — List all shopkeepers
 * GET    /:id           — Get single shopkeeper
 * PUT    /:id           — Update shopkeeper
 * PUT    /:id/credits   — Add credits
 * DELETE /:id           — Soft delete
 * DELETE /:id/permanent — Hard delete
 */

const express = require('express');
const router = express.Router();

const Shopkeeper = require('../models/Shopkeeper');
const Device = require('../models/Device');
const ActivationKey = require('../models/ActivationKey');
const CommandLog = require('../models/CommandLog');
const CreditTransaction = require('../models/CreditTransaction');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { generateAndUploadWallpaper } = require('../utils/wallpaper');

// All routes require admin auth
router.use(authenticate, authorizeAdmin);

// ─── GET / — List all shopkeepers ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, active } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // Search by name or shop name
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { shopkeeperName: regex },
        { shopName: regex },
        { mobileNo: regex },
      ];
    }

    // Filter by active status
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const shopkeepers = await Shopkeeper.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Attach virtual counts for devices and keys
    const enriched = await Promise.all(
      shopkeepers.map(async (sk) => {
        const [deviceCount, keyCount] = await Promise.all([
          Device.countDocuments({ shopkeeperId: sk._id, isDeleted: { $ne: true } }),
          ActivationKey.countDocuments({ shopkeeperId: sk._id }),
        ]);
        return { ...sk, deviceCount, keyCount };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Shopkeepers retrieved successfully.',
      data: { shopkeepers: enriched, count: enriched.length },
    });
  } catch (error) {
    console.error('List shopkeepers error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching shopkeepers.',
      data: {},
    });
  }
});

// ─── GET /:id — Get single shopkeeper ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const shopkeeper = await Shopkeeper.findById(req.params.id)
      .select('-password')
      .lean();

    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    const deviceCount = await Device.countDocuments({
      shopkeeperId: shopkeeper._id,
      isDeleted: { $ne: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Shopkeeper retrieved successfully.',
      data: { shopkeeper: { ...shopkeeper, deviceCount } },
    });
  } catch (error) {
    console.error('Get shopkeeper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching shopkeeper.',
      data: {},
    });
  }
});

// ─── PUT /:id — Update shopkeeper fields ─────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['shopkeeperName', 'shopName', 'location', 'gmail', 'isActive'];
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

    const nameOrShopChanged = updates.shopkeeperName !== undefined || updates.shopName !== undefined;

    const shopkeeper = await Shopkeeper.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    if (nameOrShopChanged) {
      try {
        const newWallpaperUrl = await generateAndUploadWallpaper(
          shopkeeper.shopName,
          shopkeeper.mobileNo,
          shopkeeper._id.toString(),
          shopkeeper.wallpaperUrl
        );
        shopkeeper.wallpaperUrl = newWallpaperUrl;
        await shopkeeper.save();
        console.log(`[AdminShopkeeperUpdate] Wallpaper regenerated successfully for shopkeeper: ${shopkeeper._id}`);
      } catch (err) {
        console.error('[AdminShopkeeperUpdate] Failed to regenerate wallpaper on shopkeeper update:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Shopkeeper updated successfully.',
      data: { shopkeeper },
    });
  } catch (error) {
    console.error('Update shopkeeper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating shopkeeper.',
      data: {},
    });
  }
});

// ─── PUT /:id/credits — Add credits ─────────────────────────────────
router.put('/:id/credits', async (req, res) => {
  try {
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'A positive numeric amount is required.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findById(req.params.id);
    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    const balanceBefore = shopkeeper.credits || 0;
    const balanceAfter = balanceBefore + amount;

    // Update shopkeeper credits
    shopkeeper.credits = balanceAfter;
    await shopkeeper.save();

    // Create credit transaction record
    const transaction = await CreditTransaction.create({
      shopkeeperId: shopkeeper._id,
      type: 'purchase',
      amount,
      pricePerCredit: 1,
      totalPrice: amount,
      balanceBefore,
      balanceAfter,
      paymentMethod: paymentMethod || 'manual',
      paymentReference: paymentReference || '',
      notes: notes || '',
      approvedBy: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: `${amount} credits added successfully.`,
      data: {
        credits: balanceAfter,
        transaction,
      },
    });
  } catch (error) {
    console.error('Add credits error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error adding credits.',
      data: {},
    });
  }
});

// ─── DELETE /:id — Soft delete ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const shopkeeper = await Shopkeeper.findById(req.params.id);

    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    shopkeeper.isDeleted = true;
    shopkeeper.isActive = false;
    await shopkeeper.save();

    return res.status(200).json({
      success: true,
      message: 'Shopkeeper soft-deleted successfully.',
      data: {},
    });
  } catch (error) {
    console.error('Soft delete shopkeeper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting shopkeeper.',
      data: {},
    });
  }
});

// ─── DELETE /:id/permanent — Hard delete ─────────────────────────────
router.delete('/:id/permanent', async (req, res) => {
  try {
    if (!req.body.confirmDelete) {
      return res.status(400).json({
        success: false,
        message: 'Set confirmDelete: true to permanently delete.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findById(req.params.id);
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    // Delete all related data
    await Promise.all([
      ActivationKey.deleteMany({ shopkeeperId: shopkeeper._id }),
      Device.deleteMany({ shopkeeperId: shopkeeper._id }),
      CommandLog.deleteMany({ shopkeeperId: shopkeeper._id }),
      CreditTransaction.deleteMany({ shopkeeperId: shopkeeper._id }),
      Shopkeeper.findByIdAndDelete(shopkeeper._id),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Shopkeeper and all related data permanently deleted.',
      data: {},
    });
  } catch (error) {
    console.error('Hard delete shopkeeper error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error permanently deleting shopkeeper.',
      data: {},
    });
  }
});

module.exports = router;
