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
const Distributor = require('../models/Distributor');
const { authenticate, authorizeRoles, authorizeAdmin } = require('../middleware/auth');
const { generateAndUploadWallpaper } = require('../utils/wallpaper');

// Authenticate all routes for admin or distributor
router.use(authenticate, authorizeRoles('super_admin', 'support_admin', 'distributor'));

// ─── GET / — List all shopkeepers ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, active, distributorId } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // Role-based scoping: Distributor callers ONLY see shopkeepers registered under them
    if (req.user.role === 'distributor') {
      if (!req.user.distributorId) {
        return res.status(200).json({
          success: true,
          message: 'Shopkeepers retrieved successfully.',
          data: { shopkeepers: [], count: 0 },
        });
      }
      filter.distributorId = req.user.distributorId;
    } else if (distributorId && distributorId.trim()) {
      // Super Admin filtering by specific distributorId
      filter.distributorId = distributorId.trim().toUpperCase();
    }

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
      .sort({ createdAt: -1 });

    // Attach virtual counts for devices and keys
    const enriched = await Promise.all(
      shopkeepers.map(async (sk) => {
        const [deviceCount, keyCount] = await Promise.all([
          Device.countDocuments({ shopkeeperId: sk._id, isDeleted: { $ne: true } }),
          ActivationKey.countDocuments({ shopkeeperId: sk._id }),
        ]);
        return { ...sk.toJSON(), deviceCount, keyCount };
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
    const shopkeeper = await Shopkeeper.findById(req.params.id);

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
      data: { shopkeeper: { ...shopkeeper.toJSON(), deviceCount } },
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

// ─── PUT /:id/credits — Add/Deduct credits ───────────────────────────
router.put('/:id/credits', async (req, res) => {
  try {
    const { amount, platform = 'android', paymentMethod, paymentReference, notes } = req.body;

    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-zero numeric amount is required.',
        data: {},
      });
    }

    const targetPlatform = platform === 'ios' ? 'ios' : 'android';

    const shopkeeper = await Shopkeeper.findById(req.params.id);
    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    let distributorDoc = null;

    // Distributor scoping & balance checks
    if (req.user.role === 'distributor') {
      if (shopkeeper.distributorId !== req.user.distributorId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This shopkeeper is not registered under your distributor account.',
          data: {},
        });
      }

      distributorDoc = await Distributor.findById(req.user.id);
      if (!distributorDoc) {
        return res.status(404).json({
          success: false,
          message: 'Distributor account not found.',
          data: {},
        });
      }

      // Check distributor has enough credits if adding
      const distPlatformCredits = targetPlatform === 'ios' ? (distributorDoc.iosCredits || 0) : (distributorDoc.androidCredits || 0);
      if (amount > 0 && distPlatformCredits < amount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient distributor ${targetPlatform} credits. You have ${distPlatformCredits} ${targetPlatform} credits remaining.`,
          data: {},
        });
      }
    }

    const balanceBefore = shopkeeper.credits || 0;
    const balanceAndroidBefore = shopkeeper.androidCredits || 0;
    const balanceIosBefore = shopkeeper.iosCredits || 0;

    if (targetPlatform === 'ios') {
      shopkeeper.iosCredits = (shopkeeper.iosCredits || 0) + amount;
      if (shopkeeper.iosCredits < 0) shopkeeper.iosCredits = 0;
    } else {
      shopkeeper.androidCredits = (shopkeeper.androidCredits || 0) + amount;
      if (shopkeeper.androidCredits < 0) shopkeeper.androidCredits = 0;
    }

    // Keep legacy credits field in sync
    shopkeeper.credits = (shopkeeper.androidCredits || 0) + (shopkeeper.iosCredits || 0);
    await shopkeeper.save();

    // Deduct/Add back from distributor balance
    if (distributorDoc) {
      if (targetPlatform === 'ios') {
        distributorDoc.iosCredits = (distributorDoc.iosCredits || 0) - amount;
        if (distributorDoc.iosCredits < 0) distributorDoc.iosCredits = 0;
      } else {
        distributorDoc.androidCredits = (distributorDoc.androidCredits || 0) - amount;
        if (distributorDoc.androidCredits < 0) distributorDoc.androidCredits = 0;
      }
      distributorDoc.credits = (distributorDoc.androidCredits || 0) + (distributorDoc.iosCredits || 0);
      await distributorDoc.save();
    }

    const balanceAfter = shopkeeper.credits;
    const balanceAndroidAfter = shopkeeper.androidCredits;
    const balanceIosAfter = shopkeeper.iosCredits;

    const transactionType = amount < 0 ? 'deduction' : 'purchase';

    // Create credit transaction record
    const transaction = await CreditTransaction.create({
      shopkeeperId: shopkeeper._id,
      type: transactionType,
      platform: targetPlatform,
      amount,
      pricePerCredit: amount < 0 ? 0 : 1,
      totalPrice: amount < 0 ? 0 : amount,
      balanceBefore,
      balanceAfter,
      balanceAndroidBefore,
      balanceAndroidAfter,
      balanceIosBefore,
      balanceIosAfter,
      paymentMethod: paymentMethod || (req.user.role === 'distributor' ? 'distributor_transfer' : 'manual'),
      paymentReference: paymentReference || '',
      notes: notes || (req.user.role === 'distributor' ? `Transferred by Distributor ${req.user.distributorId}` : ''),
      approvedBy: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: `${amount < 0 ? Math.abs(amount) + ' ' + targetPlatform.toUpperCase() + ' credits deducted' : amount + ' ' + targetPlatform.toUpperCase() + ' credits added'} successfully.`,
      data: {
        credits: balanceAfter,
        androidCredits: balanceAndroidAfter,
        iosCredits: balanceIosAfter,
        distributorCreditsRemaining: distributorDoc ? distributorDoc.credits : undefined,
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
