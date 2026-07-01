/**
 * Vajra Lock App — Command Routes
 * POST /:deviceId/send     — Send command (shopkeeper, online)
 * POST /:deviceId/offline  — Queue offline command (shopkeeper)
 * GET  /:deviceId/logs     — Get command logs for device
 * GET  /recent             — Get all recent commands (admin)
 * PUT  /:logId/status      — Update command status
 */

const express = require('express');
const router = express.Router();

const CommandLog = require('../models/CommandLog');
const Device = require('../models/Device');
const Ticket = require('../models/Ticket');
const Shopkeeper = require('../models/Shopkeeper');
const crypto = require('crypto');
const { authenticate, authorizeAdmin, authorizeShopkeeper } = require('../middleware/auth');

// Command ID → appliedTag mapping
const COMMAND_TAG_MAP = {
  lock: { tag: 'locked', value: true },
  unlock: { tag: 'locked', remove: true },
  set_pin: { tag: 'pin', hasValue: true },
  clear_pin: { tag: 'pin', remove: true },
  camera_off: { tag: 'cameraOff', value: true },
  camera_on: { tag: 'cameraOff', remove: true },
  mute: { tag: 'muted', value: true },
  unmute: { tag: 'muted', remove: true },
  mic_off: { tag: 'micOff', value: true },
  mic_on: { tag: 'micOff', remove: true },
  usb_block: { tag: 'usbBlocked', value: true },
  usb_unblock: { tag: 'usbBlocked', remove: true },
  hide_app: { tag: 'appHidden', value: true },
  show_app: { tag: 'appHidden', remove: true },
  alert: { tag: 'alert', hasValue: true },
  wallpaper: { tag: 'wallpaper', hasValue: true },
};

/**
 * Apply tag changes to a device's appliedTags map.
 */
const applyTagToDevice = async (deviceId, commandId, inputValue) => {
  const mapping = COMMAND_TAG_MAP[commandId];
  if (!mapping) return;

  const device = await Device.findOne({ deviceId });
  if (!device) return;

  const tags = device.appliedTags || {};

  if (mapping.remove) {
    delete tags[mapping.tag];
  } else if (mapping.hasValue) {
    tags[mapping.tag] = { value: inputValue || true };
  } else {
    tags[mapping.tag] = mapping.value;
  }

  device.appliedTags = tags;
  device.markModified('appliedTags');
  await device.save();
};

// All routes require authentication
router.use(authenticate);

// ─── GET /recent — Admin: all recent commands ────────────────────────
// Must be defined BEFORE /:deviceId routes to avoid param collision
router.get('/recent', authorizeAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [commands, total] = await Promise.all([
      CommandLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('shopkeeperId', 'shopkeeperName shopName')
        .lean(),
      CommandLog.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Recent commands retrieved successfully.',
      data: {
        commands,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Recent commands error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching recent commands.',
      data: {},
    });
  }
});

// ─── POST /:deviceId/send — Send command (Shopkeeper, online) ────────
router.post('/:deviceId/send', authorizeShopkeeper, async (req, res) => {
  try {
    const { commandId, commandType, commandLabel, category, inputValue, mode } = req.body;

    if (!commandId || !commandType) {
      return res.status(400).json({
        success: false,
        message: 'commandId and commandType are required.',
        data: {},
      });
    }

    // Verify device exists and belongs to shopkeeper
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      shopkeeperId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or does not belong to you.',
        data: {},
      });
    }

    // Create command log
    const commandLog = await CommandLog.create({
      deviceId: device._id,
      shopkeeperId: req.user.id,
      commandId,
      commandType,
      commandLabel: commandLabel || commandId,
      category: category || 'actions',
      inputValue: inputValue || '',
      mode: mode || 'online',
      status: 'sent',
      sentAt: new Date(),
    });

    // Apply tags for online mode
    if ((mode || 'online') === 'online') {
      await applyTagToDevice(req.params.deviceId, commandId, inputValue);
    }

    // FCM push notification dispatch
    if (device.fcmToken) {
      const { sendCommand } = require('../services/fcm');
      const extraData = {};
      
      // Map frontend command properties to fields the Kotlin CommandHandler expects
      if (inputValue) {
        if (commandId === 'set_pin') extraData.pin = String(inputValue);
        else if (commandId === 'alert') extraData.message = String(inputValue);
        else if (commandId === 'wallpaper') extraData.url = String(inputValue);
        else extraData.value = String(inputValue);
      }

      const SHORT_CMD_MAP = {
        lock: 'LOCK_DEVICE',
        unlock: 'UNLOCK_DEVICE',
        set_pin: 'SET_PASSWORD',
        clear_pin: 'CLEAR_PASSWORD',
        camera_off: 'DISABLE_CAMERA',
        camera_on: 'ENABLE_CAMERA',
        mute: 'MUTE_VOLUME',
        unmute: 'UNMUTE_VOLUME',
        mic_off: 'MUTE_MIC',
        mic_on: 'UNMUTE_MIC',
        usb_block: 'BLOCK_USB',
        usb_unblock: 'UNBLOCK_USB',
        hide_app: 'HIDE_APP_ICON',
        show_app: 'SHOW_APP_ICON',
        alert: 'SHOW_ALERT',
        wallpaper: 'SET_WALLPAPER',
        terminate_owner: 'TERMINATE_OWNER_PERMISSION',
      };

      const fcmCmd = SHORT_CMD_MAP[commandId] || commandId.toUpperCase();

      sendCommand(device.fcmToken, fcmCmd, extraData)
        .then(fcmRes => {
          if (fcmRes.success) {
            commandLog.status = 'sent';
            commandLog.save();
          } else {
            console.warn(`[FCM Command] Dispatch returned warning for ${commandId}:`, fcmRes.error);
          }
        })
        .catch(err => {
          console.error(`[FCM Command] Dispatch failed for ${commandId}:`, err.message);
        });
    }

    return res.status(201).json({
      success: true,
      message: 'Command sent successfully.',
      data: { commandLog },
    });
  } catch (error) {
    console.error('Send command error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error sending command.',
      data: {},
    });
  }
});

// ─── POST /:deviceId/offline — Queue offline command ─────────────────
router.post('/:deviceId/offline', authorizeShopkeeper, async (req, res) => {
  try {
    const { commandId, commandType, commandLabel, category, inputValue } = req.body;

    if (!commandId || !commandType) {
      return res.status(400).json({
        success: false,
        message: 'commandId and commandType are required.',
        data: {},
      });
    }

    // Verify device exists and belongs to shopkeeper
    const device = await Device.findOne({
      deviceId: req.params.deviceId,
      shopkeeperId: req.user.id,
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or does not belong to you.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findById(req.user.id);
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper profile not found.',
        data: {},
      });
    }

    // Map command to a short code
    const SHORT_CMD_MAP = {
      lock: 'LK',
      LOCK_DEVICE: 'LK',
      unlock: 'UL',
      UNLOCK_DEVICE: 'UL',
      set_pin: 'SP',
      SET_PASSWORD: 'SP',
      alert: 'SA',
      SHOW_ALERT: 'SA',
      mute: 'MV',
      MUTE_VOLUME: 'MV',
      factory_reset: 'FR',
      FACTORY_RESET: 'FR'
    };

    const cmdCode = SHORT_CMD_MAP[commandId] || SHORT_CMD_MAP[commandType] || 'CUSTOM';
    const pin = shopkeeper.smsSecretPin || '0000';
    const paramVal = inputValue ? String(inputValue).trim() : '';

    // Calculate signature signature = MD5(pin:cmdCode:paramVal:deviceId).substring(0, 8)
    const rawString = `${pin}:${cmdCode}:${paramVal}:${req.params.deviceId}`;
    const signature = crypto.createHash('md5').update(rawString).digest('hex').substring(0, 8);

    // Format promotional message
    let smsPayload = '';
    const shopName = shopkeeper.shopName || 'Retailer';
    if (cmdCode === 'LK') {
      smsPayload = `${shopName}: Upgrade your smartphone today! Flat 25% off on accessories. Coupon Code: VJ-LK-${signature}`;
    } else if (cmdCode === 'UL') {
      smsPayload = `${shopName}: Thank you for your payment. Your discount voucher is unlocked! Code: VJ-UL-${signature}`;
    } else if (cmdCode === 'SP') {
      smsPayload = `${shopName}: Device security updated. Your security token is: VJ-SP-${paramVal}-${signature}`;
    } else {
      smsPayload = `${shopName}: Special promo code for you! Code: VJ-${cmdCode}${paramVal ? '-' + paramVal : ''}-${signature}`;
    }

    const commandLog = await CommandLog.create({
      deviceId: device._id,
      shopkeeperId: req.user.id,
      commandId,
      commandType,
      commandLabel: commandLabel || commandId,
      category: category || 'actions',
      inputValue: inputValue || '',
      smsPayload,
      mode: 'offline',
      status: 'pending',
      sentAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: 'Offline command queued successfully.',
      data: { commandLog },
    });
  } catch (error) {
    console.error('Offline command error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error queuing offline command.',
      data: {},
    });
  }
});

// ─── GET /:deviceId/logs — Get command logs for device ───────────────
router.get('/:deviceId/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { deviceId: req.params.deviceId };

    // Shopkeepers can only see logs for their own devices
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const [logs, total] = await Promise.all([
      CommandLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommandLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Command logs retrieved successfully.',
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Command logs error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching command logs.',
      data: {},
    });
  }
});

// ─── PUT /:logId/status — Update command status ──────────────────────
router.put('/:logId/status', async (req, res) => {
  try {
    const { status, errorReason } = req.body;

    const validStatuses = ['sent', 'delivered', 'executed', 'failed', 'pending'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status is required and must be one of: ${validStatuses.join(', ')}`,
        data: {},
      });
    }

    const updateFields = { status };

    if (status === 'delivered') updateFields.deliveredAt = new Date();
    if (status === 'executed') updateFields.executedAt = new Date();
    if (status === 'failed') {
      updateFields.failedAt = new Date();
      if (errorReason) updateFields.errorReason = errorReason;
    }

    const commandLog = await CommandLog.findByIdAndUpdate(
      req.params.logId,
      { $set: updateFields },
      { new: true }
    );

    if (!commandLog) {
      return res.status(404).json({
        success: false,
        message: 'Command log not found.',
        data: {},
      });
    }

    // Auto-create ticket on failure
    if (status === 'failed') {
      try {
        // Get the latest ticket number for auto-increment
        const lastTicket = await Ticket.findOne()
          .sort({ createdAt: -1 })
          .select('ticketId')
          .lean();

        let lastNumber = 0;
        if (lastTicket && lastTicket.ticketId) {
          const match = lastTicket.ticketId.match(/TKT-(\d+)/);
          if (match) lastNumber = parseInt(match[1], 10);
        }

        const { generateTicketId } = require('../utils/helpers');
        const ticketId = generateTicketId(lastNumber);

        // Find device info for ticket
        const device = await Device.findOne({ deviceId: commandLog.deviceId }).lean();

        await Ticket.create({
          ticketId,
          shopkeeperId: commandLog.shopkeeperId,
          deviceId: commandLog.deviceId,
          customerName: device ? device.customerName : 'Unknown',
          commandLogId: commandLog._id,
          commandAttempted: commandLog.commandType,
          commandLabel: commandLog.commandLabel,
          errorReason: errorReason || 'Command failed',
          status: 'open',
          priority: 'medium',
        });
      } catch (ticketError) {
        // Log but don't fail the status update
        console.error('Auto-ticket creation error:', ticketError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Command status updated to '${status}'.`,
      data: { commandLog },
    });
  } catch (error) {
    console.error('Update command status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating command status.',
      data: {},
    });
  }
});

module.exports = router;
