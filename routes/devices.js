/**
 * Vajra Lock App — Device Routes (Mixed Auth)
 * GET    /                    — List devices (role-scoped)
 * GET    /:deviceId           — Get device by deviceId
 * POST   /activate            — Activate device (shopkeeper)
 * PUT    /:deviceId           — Update customer details
 * PUT    /:deviceId/heartbeat — Heartbeat from Android (no auth)
 * DELETE /:deviceId           — Soft delete
 * DELETE /:deviceId/permanent — Hard delete (admin only)
 */

const express = require('express');
const router = express.Router();

const Device = require('../models/Device');
const ActivationKey = require('../models/ActivationKey');
const Shopkeeper = require('../models/Shopkeeper');
const CommandLog = require('../models/CommandLog');
const CreditTransaction = require('../models/CreditTransaction');
const { authenticate, authorizeAdmin, authorizeShopkeeper } = require('../middleware/auth');
const { generateDeviceId } = require('../utils/helpers');

// ─── PUT /:deviceId/heartbeat — No auth (Android app) ───────────────
// Must be defined BEFORE the authenticate middleware to avoid auth check
router.put('/:deviceId/heartbeat', async (req, res) => {
  try {
    const {
      batteryLevel,
      isCharging,
      isOnline,
      networkType,
      latitude,
      longitude,
      storageAvailable,
      ramAvailable,
      isLocked,
      appVersion,
      isDeviceOwner,
    } = req.body;

    const updateFields = { lastSeen: new Date() };

    if (batteryLevel !== undefined) updateFields.batteryLevel = batteryLevel;
    if (isCharging !== undefined) updateFields.isCharging = isCharging;
    if (isOnline !== undefined) updateFields.isOnline = isOnline;
    if (networkType !== undefined) updateFields.networkType = networkType;
    if (storageAvailable !== undefined) updateFields.storageAvailable = storageAvailable;
    if (ramAvailable !== undefined) updateFields.ramAvailable = ramAvailable;
    if (isLocked !== undefined) updateFields.isLocked = isLocked;
    if (appVersion !== undefined) updateFields.appVersion = appVersion;
    if (isDeviceOwner !== undefined) updateFields.isDeviceOwner = isDeviceOwner;

    // Update location as GeoJSON Point
    if (latitude !== undefined && longitude !== undefined) {
      updateFields.location = {
        type: 'Point',
        coordinates: [longitude, latitude], // GeoJSON = [lng, lat]
      };
    }

    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { $set: updateFields },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Heartbeat received.',
      data: { lastSeen: device.lastSeen },
    });
  } catch (error) {
    console.error('Heartbeat error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error processing heartbeat.',
      data: {},
    });
  }
});

// All routes below require authentication
router.use(authenticate);

// ─── GET / — List devices (role-scoped) ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, online, locked } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // Scope to shopkeeper's own devices
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    // Search filter
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { customerName: regex },
        { customerMobile: regex },
        { deviceId: regex },
        { deviceModel: regex },
      ];
    }

    // Online filter
    if (online !== undefined) {
      filter.isOnline = online === 'true';
    }

    // Locked filter
    if (locked !== undefined) {
      filter.isLocked = locked === 'true';
    }

    const devices = await Device.find(filter)
      .populate('shopkeeperId', 'shopkeeperName shopName')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Devices retrieved successfully.',
      data: { devices, count: devices.length },
    });
  } catch (error) {
    console.error('List devices error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching devices.',
      data: {},
    });
  }
});

// ─── GET /:deviceId — Get device by deviceId field ───────────────────
router.get('/:deviceId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.deviceId);
    const filter = isObjectId
      ? { $or: [{ deviceId: req.params.deviceId }, { _id: req.params.deviceId }] }
      : { deviceId: req.params.deviceId };

    // Shopkeepers can only see their own devices
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const device = await Device.findOne(filter)
      .populate('shopkeeperId', 'shopkeeperName shopName mobileNo')
      .lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device retrieved successfully.',
      data: { device },
    });
  } catch (error) {
    console.error('Get device error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching device.',
      data: {},
    });
  }
});

// ─── POST /activate — Activate a device (Shopkeeper only) ────────────
router.post('/activate', authorizeShopkeeper, async (req, res) => {
  try {
    const {
      key,
      customerName,
      customerMobile,
      deviceModel,
      totalAmount,
      emiAmount,
      totalMonths,
      interestRate,
    } = req.body;

    // Validation
    if (!key || !customerName || !customerMobile || !deviceModel) {
      return res.status(400).json({
        success: false,
        message: 'key, customerName, customerMobile, and deviceModel are required.',
        data: {},
      });
    }

    // Step 1: Find unused activation key
    const activationKey = await ActivationKey.findOne({
      key,
      isUsed: false,
    });

    if (!activationKey) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or already used activation key.',
        data: {},
      });
    }

    // Verify key belongs to this shopkeeper
    if (activationKey.shopkeeperId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This key does not belong to you.',
        data: {},
      });
    }

    // Step 2: Check shopkeeper has credits
    const shopkeeper = await Shopkeeper.findById(req.user.id);
    if (!shopkeeper || (shopkeeper.credits || 0) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient credits. You need at least 1 credit to activate a device.',
        data: {},
      });
    }

    const balanceBefore = shopkeeper.credits;

    // Step 3: Deduct 1 credit
    shopkeeper.credits -= 1;
    await shopkeeper.save();

    const balanceAfter = shopkeeper.credits;

    // Step 4: Create device
    const deviceId = generateDeviceId();
    const device = await Device.create({
      deviceId,
      activationKey: key,
      activationKeyId: activationKey._id,
      shopkeeperId: req.user.id,
      customerName,
      customerMobile,
      deviceModel,
      totalAmount: totalAmount || 0,
      emiAmount: emiAmount || 0,
      totalEmis: totalMonths || 0,
      interestRate: interestRate || 0,
      isActive: true,
      registeredAt: new Date(),
    });

    // Step 5: Update activation key
    activationKey.status = 'activated';
    activationKey.isUsed = true;
    activationKey.activatedAt = new Date();
    activationKey.deviceId = device._id;
    activationKey.customerName = customerName;
    activationKey.customerMobile = customerMobile;
    await activationKey.save();

    // Step 6: Create credit transaction
    await CreditTransaction.create({
      shopkeeperId: req.user.id,
      type: 'deduction',
      amount: -1,
      pricePerCredit: 1,
      totalPrice: 0,
      balanceBefore,
      balanceAfter,
      description: `Device activation: ${deviceId}`,
      approvedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Device activated successfully.',
      data: {
        device,
        creditsRemaining: balanceAfter,
      },
    });
  } catch (error) {
    console.error('Activate device error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error activating device.',
      data: {},
    });
  }
});

// ─── PUT /:deviceId — Update customer details ────────────────────────
router.put('/:deviceId', async (req, res) => {
  try {
    const allowedFields = [
      'customerName',
      'customerMobile',
      'deviceModel',
      'totalEmis',
      'interestRate',
      'paidEmis',
      'emiAmount',
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

    const filter = { deviceId: req.params.deviceId };

    // Shopkeepers can only update their own devices
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const device = await Device.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device updated successfully.',
      data: { device },
    });
  } catch (error) {
    console.error('Update device error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating device.',
      data: {},
    });
  }
});

// ─── DELETE /:deviceId — Soft delete ─────────────────────────────────
router.delete('/:deviceId', async (req, res) => {
  try {
    const filter = { deviceId: req.params.deviceId };

    // Shopkeepers can only delete their own devices
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const device = await Device.findOneAndUpdate(
      filter,
      {
        $set: {
          isActive: false,
          isDeleted: true,
          deactivatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device deactivated and soft-deleted.',
      data: {},
    });
  } catch (error) {
    console.error('Soft delete device error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting device.',
      data: {},
    });
  }
});

// ─── DELETE /:deviceId/permanent — Hard delete (Admin only) ──────────
router.delete('/:deviceId/permanent', authorizeAdmin, async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
        data: {},
      });
    }

    // Delete device and related command logs
    await Promise.all([
      CommandLog.deleteMany({ deviceId: device._id }),
      Device.findByIdAndDelete(device._id),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Device and related logs permanently deleted.',
      data: {},
    });
  } catch (error) {
    console.error('Hard delete device error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error permanently deleting device.',
      data: {},
    });
  }
});

module.exports = router;
