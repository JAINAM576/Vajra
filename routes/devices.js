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
const validate = require('../middleware/validator');

const activateDeviceSchema = {
  key: { required: true, requiredMessage: 'key, customerName, customerMobile, and deviceModel are required.' },
  customerName: { required: true, requiredMessage: 'key, customerName, customerMobile, and deviceModel are required.' },
  customerMobile: { required: true, requiredMessage: 'key, customerName, customerMobile, and deviceModel are required.' },
  deviceModel: { required: true, requiredMessage: 'key, customerName, customerMobile, and deviceModel are required.' }
};

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

// ─── GET / — List devices (role-scoped, with pagination, filters & stats) ────
router.get('/', async (req, res) => {
  try {
    const { search, filter: filterParam, page: pageParam, limit: limitParam, online, locked } = req.query;

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = limitParam === 'all' || !limitParam ? 10000 : Math.max(1, parseInt(limitParam) || 10000);

    // Base filter: exclude soft-deleted devices
    const baseFilter = { isDeleted: { $ne: true } };

    // Scope to shopkeeper's own devices and exclude shopkeeper-deleted devices
    if (req.user.role === 'shopkeeper') {
      const mongoose = require('mongoose');
      const shopkeeperObjectId = mongoose.Types.ObjectId.isValid(req.user.id)
        ? new mongoose.Types.ObjectId(req.user.id)
        : req.user.id;

      baseFilter.shopkeeperId = { $in: [req.user.id, shopkeeperObjectId] };
      baseFilter.isDeletedByShopkeeper = { $ne: true };
    }

    // Search filter — applied to both stats query and list query
    if (search) {
      const regex = new RegExp(search, 'i');
      baseFilter.$or = [
        { customerName: regex },
        { customerMobile: regex },
        { deviceId: regex },
        { deviceModel: regex },
      ];
    }

    // Legacy query-param compat
    if (online !== undefined) {
      baseFilter.isOnline = online === 'true';
    }
    if (locked !== undefined) {
      baseFilter.isLocked = locked === 'true';
    }

    // ── Fetch ALL devices matching base filter (for stats) ──
    const allDevices = await Device.find(baseFilter)
      .sort({ createdAt: -1 })
      .lean();

    // ── Compute stats across all devices (unfiltered by tab) ──
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    let onlineCount = 0;
    let lockedCount = 0;
    let emiDueCount = 0;
    let emiLowCount = 0;
    let recentCount = 0;
    let totalEmiPending = 0;

    const remindersList = [];

    for (const d of allDevices) {
      // Online: has heartbeat within last 5 minutes
      const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
      const isDeviceOnline = d.isOnline === true || (lastSeen && (now.getTime() - lastSeen.getTime()) < OFFLINE_THRESHOLD_MS);
      if (isDeviceOnline) onlineCount++;

      if (d.isLocked) lockedCount++;

      // EMI calculations
      const totalEmis = d.totalEmis || 0;
      const paidEmis = d.paidEmis || 0;
      const emiAmount = d.emiAmount || 0;
      const emiRemaining = d.emiRemaining || 0;

      if (emiRemaining > 0) totalEmiPending += emiRemaining;

      // EMI due: has remaining EMIs and not completed
      const purchaseDateVal = d.purchaseDate || d.registeredAt || d.createdAt;
      const purchaseDate = purchaseDateVal ? new Date(purchaseDateVal) : null;

      if (!d.isCompleted && totalEmis > 0 && paidEmis < totalEmis && purchaseDate) {
        // Calculate the next EMI due date
        const nextDueMonth = paidEmis + 1;
        const nextDueDate = new Date(purchaseDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + nextDueMonth);

        const isOverdue = now > nextDueDate;
        const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (isOverdue || daysUntilDue <= 7) {
          emiDueCount++;

          // Build reminder
          let reminderStatus = 'upcoming';
          let reminderMessage = '';
          if (isOverdue) {
            reminderStatus = 'overdue';
            const daysBehind = Math.abs(daysUntilDue);
            reminderMessage = `${d.customerName}'s EMI of ₹${emiAmount} is ${daysBehind} day(s) overdue.`;
          } else if (daysUntilDue <= 0) {
            reminderStatus = 'today';
            reminderMessage = `${d.customerName}'s EMI of ₹${emiAmount} is due today.`;
          } else {
            reminderStatus = 'upcoming';
            reminderMessage = `${d.customerName}'s EMI of ₹${emiAmount} is due in ${daysUntilDue} day(s).`;
          }

          remindersList.push({
            id: d._id.toString(),
            customerName: d.customerName,
            customerMobile: d.customerMobile,
            emiAmount,
            status: reminderStatus,
            message: reminderMessage,
            device: d,
          });
        }
      }

      // EMI low: paid less than 50% of total EMIs
      if (!d.isCompleted && totalEmis > 0 && paidEmis > 0 && (paidEmis / totalEmis) < 0.5) {
        emiLowCount++;
      }

      // Recent: registered within last 7 days
      const createdAt = d.createdAt ? new Date(d.createdAt) : null;
      if (createdAt && createdAt >= sevenDaysAgo) {
        recentCount++;
      }
    }

    const totalDevices = allDevices.length;

    const stats = {
      totalDevices,
      onlineCount,
      lockedCount,
      emiDueCount,
      emiLowCount,
      recentCount,
      totalEmiPending,
    };

    // Sort reminders: overdue first, then today, then upcoming
    const statusOrder = { overdue: 0, today: 1, upcoming: 2 };
    remindersList.sort((a, b) => (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9));

    // ── Apply tab filter to select which devices to return ──
    let filteredDevices = allDevices;
    if (filterParam && filterParam !== 'all') {
      filteredDevices = allDevices.filter((d) => {
        const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
        const isDeviceOnline = d.isOnline === true || (lastSeen && (now.getTime() - lastSeen.getTime()) < OFFLINE_THRESHOLD_MS);

        switch (filterParam) {
          case 'online':
            return isDeviceOnline;
          case 'offline':
            return !isDeviceOnline;
          case 'locked':
            return d.isLocked === true;
          case 'emi_due': {
            const totalEmis = d.totalEmis || 0;
            const paidEmis = d.paidEmis || 0;
            const purchaseDateVal = d.purchaseDate || d.registeredAt || d.createdAt;
            const purchaseDate = purchaseDateVal ? new Date(purchaseDateVal) : null;
            if (d.isCompleted || totalEmis === 0 || paidEmis >= totalEmis || !purchaseDate) return false;
            const nextDueMonth = paidEmis + 1;
            const nextDueDate = new Date(purchaseDate);
            nextDueDate.setMonth(nextDueDate.getMonth() + nextDueMonth);
            const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return (now > nextDueDate) || daysUntilDue <= 7;
          }
          case 'emi_low': {
            const totalEmis = d.totalEmis || 0;
            const paidEmis = d.paidEmis || 0;
            return !d.isCompleted && totalEmis > 0 && paidEmis > 0 && (paidEmis / totalEmis) < 0.5;
          }
          case 'recent': {
            const createdAt = d.createdAt ? new Date(d.createdAt) : null;
            return createdAt && createdAt >= sevenDaysAgo;
          }
          default:
            return true;
        }
      });
    }

    // ── Paginate ──
    const totalFiltered = filteredDevices.length;
    const startIndex = (page - 1) * limit;
    const paginatedDevices = filteredDevices.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalFiltered;

    // Populate shopkeeper info for paginated devices
    const populatedDevices = await Device.populate(paginatedDevices, {
      path: 'shopkeeperId',
      select: 'shopkeeperName shopName',
    });

    return res.status(200).json({
      success: true,
      message: 'Devices retrieved successfully.',
      data: {
        devices: populatedDevices,
        count: totalFiltered,
        page,
        hasMore,
        stats,
        reminders: remindersList.slice(0, 10),
      },
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
router.post('/activate', authorizeShopkeeper, validate(activateDeviceSchema), async (req, res) => {
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
      imei1,
      imei2,
    } = req.body;

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

    // Step 2: Check platform and credits
    const targetPlatform = (req.body.platform || 'android').toLowerCase() === 'ios' ? 'ios' : 'android';
    const shopkeeper = await Shopkeeper.findById(req.user.id);

    const availableCredits = targetPlatform === 'ios'
      ? (shopkeeper?.iosCredits || 0)
      : (shopkeeper?.androidCredits || 0);

    if (!shopkeeper || availableCredits < 1) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${targetPlatform.toUpperCase()} credits. You need at least 1 ${targetPlatform.toUpperCase()} credit to activate a device.`,
        data: {},
      });
    }

    const balanceBefore = shopkeeper.credits || 0;
    const balanceAndroidBefore = shopkeeper.androidCredits || 0;
    const balanceIosBefore = shopkeeper.iosCredits || 0;

    // Step 3: Deduct 1 credit from platform pool
    if (targetPlatform === 'ios') {
      shopkeeper.iosCredits = Math.max(0, (shopkeeper.iosCredits || 0) - 1);
      shopkeeper.totalIosCreditsUsed = (shopkeeper.totalIosCreditsUsed || 0) + 1;
    } else {
      shopkeeper.androidCredits = Math.max(0, (shopkeeper.androidCredits || 0) - 1);
      shopkeeper.totalAndroidCreditsUsed = (shopkeeper.totalAndroidCreditsUsed || 0) + 1;
    }
    shopkeeper.credits = (shopkeeper.androidCredits || 0) + (shopkeeper.iosCredits || 0);
    shopkeeper.totalCreditsUsed = (shopkeeper.totalAndroidCreditsUsed || 0) + (shopkeeper.totalIosCreditsUsed || 0);
    await shopkeeper.save();

    const balanceAfter = shopkeeper.credits;
    const balanceAndroidAfter = shopkeeper.androidCredits;
    const balanceIosAfter = shopkeeper.iosCredits;

    // Step 4: Create device
    const { generateReleaseCode } = require('../utils/helpers');
    const deviceId = generateDeviceId();
    const releaseCode = generateReleaseCode();
    const device = await Device.create({
      deviceId,
      releaseCode,
      activationKey: key,
      activationKeyId: activationKey._id,
      shopkeeperId: req.user.id,
      customerName,
      customerMobile,
      deviceModel,
      platform: targetPlatform,
      totalAmount: totalAmount || 0,
      emiRemaining: totalAmount || 0,
      emiAmount: emiAmount || 0,
      totalEmis: totalMonths || 0,
      interestRate: interestRate || 0,
      imei1: imei1 || undefined,
      imei2: imei2 || undefined,
      imei: imei1 || imei2 || undefined,
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
      platform: targetPlatform,
      amount: -1,
      pricePerCredit: 1,
      totalPrice: 0,
      balanceBefore,
      balanceAfter,
      balanceAndroidBefore,
      balanceAndroidAfter,
      balanceIosBefore,
      balanceIosAfter,
      notes: `Device activation (${targetPlatform.toUpperCase()}): ${deviceId}`,
      approvedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Device activated successfully.',
      data: {
        device,
        creditsRemaining: balanceAfter,
        androidCreditsRemaining: balanceAndroidAfter,
        iosCreditsRemaining: balanceIosAfter,
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
      'totalAmount',
      'emiRemaining',
      'isCompleted',
      'isLocked',
      'status',
      'appliedTags',
      'imei',
      'imei1',
      'imei2',
      'customAdminMobile',
      'osVersion',
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

    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.deviceId);
    const filter = isObjectId
      ? { $or: [{ deviceId: req.params.deviceId }, { _id: req.params.deviceId }] }
      : { deviceId: req.params.deviceId };

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

    if ((device.isCompleted || device.status === 'Completed') && device.activationKey) {
      await ActivationKey.updateOne(
        { key: device.activationKey.toUpperCase() },
        { $set: { status: 'completed' } }
      );
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
    const mongoose = require('mongoose');
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.deviceId);
    const filter = isObjectId
      ? { $or: [{ deviceId: req.params.deviceId }, { _id: req.params.deviceId }] }
      : { deviceId: req.params.deviceId };

    // Shopkeepers soft-delete by hiding from their dashboard (remains visible to admins)
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
      const device = await Device.findOneAndUpdate(
        filter,
        {
          $set: {
            isDeletedByShopkeeper: true,
            deactivatedAt: Date.now(),
          },
        },
        { new: true }
      );

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found or does not belong to you.',
          data: {},
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Device hidden from shopkeeper dashboard.',
        data: {},
      });
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
