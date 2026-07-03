const express = require('express');
const router = express.Router();

const Device = require('../models/Device');
const ActivationKey = require('../models/ActivationKey');
const Shopkeeper = require('../models/Shopkeeper');
const CommandLog = require('../models/CommandLog');
const Ticket = require('../models/Ticket');
const { applyTagToDevice } = require('./commands');

// ─── POST /api/device/activate — Client app device activation ─────────
router.post('/activate', async (req, res) => {
  try {
    const { activationKey, imei, fcmToken, deviceModel, androidVersion } = req.body;

    console.log(`\n📱 Client device activation: key=${activationKey}, model=${deviceModel}`);

    if (!activationKey || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'activationKey and fcmToken are required.',
      });
    }

    // Find the key record
    const keyRecord = await ActivationKey.findOne({
      key: activationKey.toUpperCase()
    });

    if (!keyRecord) {
      return res.status(404).json({
        success: false,
        message: 'Invalid activation key.',
      });
    }

    // Find if a device record was pre-created for this activation key
    let device = await Device.findOne({ activationKey: activationKey.toUpperCase() });

    if (device && device.imei && device.imei !== 'unknown' && device.imei !== imei) {
      return res.status(400).json({
        success: false,
        message: 'This activation key has already been bound to another device.',
      });
    }

    const shopkeeper = await Shopkeeper.findById(keyRecord.shopkeeperId);

    if (device) {
      // Update the pre-created device with hardware details
      device.imei = imei || device.imei || 'unknown';
      device.fcmToken = fcmToken;
      device.osVersion = androidVersion || device.osVersion || 'unknown';
      if (deviceModel) device.deviceModel = deviceModel;
      device.isDeviceOwner = true;
      device.isOnline = true;
      device.lastSeen = new Date();
      device.registeredAt = new Date();
      await device.save();
    } else {
      // Fallback: If no pre-created device record exists, create one directly (safeguard)
      const { generateDeviceId } = require('../utils/helpers');
      const deviceId = generateDeviceId();
      device = await Device.create({
        deviceId,
        activationKey: activationKey.toUpperCase(),
        shopkeeperId: keyRecord.shopkeeperId,
        customerName: 'Customer',
        customerMobile: '',
        imei: imei || 'unknown',
        fcmToken,
        deviceModel: deviceModel || 'unknown',
        osVersion: androidVersion || 'unknown',
        isDeviceOwner: true,
        isOnline: true,
        lastSeen: new Date(),
        registeredAt: new Date(),
        isActive: true,
      });
    }

    // Mark the activation key as used
    keyRecord.isUsed = true;
    keyRecord.status = 'activated';
    keyRecord.activatedAt = new Date();
    await keyRecord.save();

    console.log(`✅ Device registered successfully: ${device.deviceId}`);

    return res.status(200).json({
      success: true,
      message: 'Device registered successfully.',
      deviceId: device.deviceId,
      shopName: shopkeeper ? shopkeeper.shopName : 'Retailer',
      shopPhone: shopkeeper ? shopkeeper.mobileNo : '',
    });

  } catch (error) {
    console.error('Client activation error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error processing device activation.',
    });
  }
});

// ─── POST /api/device/heartbeat — Heartbeat updates from client ───────
router.post('/heartbeat', async (req, res) => {
  try {
    const {
      deviceId,
      lat,
      lng,
      batteryLevel,
      isLocked,
      isCharging,
      networkType,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required.',
      });
    }

    const updateFields = {
      isOnline: true,
      lastSeen: new Date(),
    };

    if (batteryLevel !== undefined) updateFields.batteryLevel = batteryLevel;
    if (isCharging !== undefined) updateFields.isCharging = isCharging;
    if (networkType !== undefined) updateFields.networkType = networkType;
    
    if (lat !== undefined && lng !== undefined) {
      updateFields.location = {
        type: 'Point',
        coordinates: [lng, lat],
      };
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: updateFields },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
      });
    }

    // Return the desired state so client lock policies remain synced with DB state
    return res.status(200).json({
      success: true,
      message: 'Heartbeat received.',
      isLocked: device.isLocked,
    });

  } catch (error) {
    console.error('Client heartbeat error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error processing client heartbeat.',
    });
  }
});

// ─── POST /api/device/update-token — Update FCM Token from client ──────
router.post('/update-token', async (req, res) => {
  try {
    const { deviceId, fcmToken } = req.body;

    if (!deviceId || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'deviceId and fcmToken are required.',
      });
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { fcmToken } },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'FCM token updated successfully.',
    });

  } catch (error) {
    console.error('Client FCM token update error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating FCM token.',
    });
  }
});

// ─── POST /api/device/info — Update hardware specifications ───────────
router.post('/info', async (req, res) => {
  try {
    const {
      deviceId,
      imei,
      deviceModel,
      androidVersion,
      appVersion,
      isDeviceOwner,
      batteryLevel,
      storageAvailable,
      ramAvailable,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required.',
      });
    }

    const updateFields = {
      lastSeen: new Date(),
    };

    if (imei) updateFields.imei = imei;
    if (deviceModel) updateFields.deviceModel = deviceModel;
    if (androidVersion) updateFields.osVersion = androidVersion;
    if (appVersion) updateFields.appVersion = appVersion;
    if (isDeviceOwner !== undefined) updateFields.isDeviceOwner = isDeviceOwner;
    if (batteryLevel !== undefined) updateFields.batteryLevel = batteryLevel;
    if (storageAvailable !== undefined) updateFields.storageAvailable = storageAvailable;
    if (ramAvailable !== undefined) updateFields.ramAvailable = ramAvailable;

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: updateFields },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device hardware specifications updated successfully.',
    });

  } catch (error) {
    console.error('Client specs update error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating device specifications.',
    });
  }
});

// ─── POST /api/device/command-status — Update command status from client ─────────
router.post('/command-status', async (req, res) => {
  try {
    const { deviceId, logId, status, errorReason } = req.body;

    console.log(`\n📡 Command status update from device ${deviceId}: logId=${logId}, status=${status}`);

    if (!deviceId || !logId || !status) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, logId, and status are required.',
      });
    }

    const commandLog = await CommandLog.findById(logId);
    if (!commandLog) {
      return res.status(404).json({
        success: false,
        message: 'Command log not found.',
      });
    }

    // Verify the command log belongs to this device
    const device = await Device.findById(commandLog.deviceId);
    if (!device || device.deviceId !== deviceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Command does not match device.',
      });
    }

    const validStatuses = ['sent', 'delivered', 'executed', 'failed', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updateFields = { status };
    if (status === 'delivered') updateFields.deliveredAt = new Date();
    if (status === 'executed') {
      updateFields.executedAt = new Date();
      // Apply the command tag to the device ONLY now when it is successfully executed!
      await applyTagToDevice(device.deviceId, commandLog.commandId, commandLog.inputValue);
      
      // Update isLocked fields for lock/unlock commands
      if (commandLog.commandId === 'lock') {
        device.isLocked = true;
        await device.save();
      } else if (commandLog.commandId === 'unlock') {
        device.isLocked = false;
        await device.save();
      }
    }
    if (status === 'failed') {
      updateFields.failedAt = new Date();
      if (errorReason) updateFields.errorReason = errorReason;
    }

    await CommandLog.findByIdAndUpdate(logId, { $set: updateFields });

    // Auto-create ticket on failure
    if (status === 'failed') {
      try {
        const lastTicket = await Ticket.findOne().sort({ createdAt: -1 }).select('ticketId').lean();
        let lastNumber = 0;
        if (lastTicket && lastTicket.ticketId) {
          const match = lastTicket.ticketId.match(/TKT-(\d+)/);
          if (match) lastNumber = parseInt(match[1], 10);
        }
        const { generateTicketId } = require('../utils/helpers');
        const ticketId = generateTicketId(lastNumber);

        await Ticket.create({
          ticketId,
          shopkeeperId: commandLog.shopkeeperId,
          deviceId: device._id,
          customerName: device.customerName || 'Unknown',
          commandLogId: commandLog._id,
          commandAttempted: commandLog.commandType,
          commandLabel: commandLog.commandLabel,
          errorReason: errorReason || 'Command failed on device',
          status: 'open',
          priority: 'medium',
        });
      } catch (ticketError) {
        console.error('Auto-ticket creation error:', ticketError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Command status updated to '${status}'.`,
    });
  } catch (error) {
    console.error('Update command status compat error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating command status.',
    });
  }
});

module.exports = router;
