/**
 * Apple MDM Events & Webhook Routes
 * Handles NanoMDM webhook callbacks and exposes iOS MDM endpoints.
 * All route handlers use strict try-catch wrappers to preserve backend stability.
 */

const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const ActivationKey = require('../models/ActivationKey');
const { enqueueDeviceLock, enqueueDeviceUnlock, checkNanoMdmHealth } = require('../services/nanoMdmService');
const { generateEnrollmentProfile } = require('../services/appleProfileService');

/**
 * @route   POST /api/mdm/events
 * @desc    NanoMDM Webhook Endpoint (Receives TokenUpdate, CheckOut, Acknowledge)
 * @access  Public (Authenticated via secret token or NanoMDM signature)
 */
router.post('/events', async (req, res) => {
  try {
    const event = req.body;
    
    if (!event) {
      return res.status(400).json({ success: false, message: 'Empty webhook payload' });
    }

    console.log(`[MDM Webhook] Event received: ${event.topic || event.type || 'unknown'}`);

    const topic = event.topic || event.type || '';
    const udid = event.udid || (event.checkin_event && event.checkin_event.udid);
    
    // Handle TokenUpdate (First enrollment / token refresh)
    if (topic.includes('TokenUpdate') || topic.includes('Authenticate')) {
      const pushToken = event.push_token || (event.checkin_event && event.checkin_event.token_update && event.checkin_event.token_update.token);
      const pushMagic = event.push_magic || (event.checkin_event && event.checkin_event.token_update && event.checkin_event.token_update.push_magic);

      if (udid) {
        // Attempt to find device by MDM UDID or update pending iOS device
        let device = await Device.findOne({ mdmUdid: udid });

        if (device) {
          device.mdmPushToken = pushToken || device.mdmPushToken;
          device.mdmPushMagic = pushMagic || device.mdmPushMagic;
          device.mdmEnrollmentStatus = 'Enrolled';
          device.isOnline = true;
          device.lastSeen = new Date();
          await device.save();
          console.log(`[MDM Webhook] Updated existing enrolled iOS device: ${udid}`);
        } else {
          console.log(`[MDM Webhook] Initial enrollment event received for UDID: ${udid}`);
        }
      }
    }

    // Handle CheckOut (Device uninstalled MDM profile)
    if (topic.includes('CheckOut')) {
      if (udid) {
        const device = await Device.findOne({ mdmUdid: udid });
        if (device) {
          device.mdmEnrollmentStatus = 'Unenrolled';
          device.isOnline = false;
          await device.save();
          console.warn(`[MDM Webhook] Device unenrolled / profile removed for UDID: ${udid}`);
        }
      }
    }

    // Always respond 200 OK to NanoMDM to acknowledge receipt
    return res.status(200).json({ success: true, message: 'Event processed successfully' });
  } catch (error) {
    console.error('❌ [MDM Webhook Error]:', error.message);
    // Return 200/500 safely without crashing process
    return res.status(500).json({ success: false, error: 'Internal error processing MDM webhook' });
  }
});

/**
 * @route   POST /api/mdm/lock
 * @desc    Enqueue a Device Lock command for an iOS device
 * @access  Private / Shopkeeper / Admin
 */
router.post('/lock', async (req, res) => {
  try {
    const { deviceId, udid, pinCode } = req.body;

    let targetUdid = udid;
    if (!targetUdid && deviceId) {
      const device = await Device.findById(deviceId);
      if (device) {
        targetUdid = device.mdmUdid;
      }
    }

    if (!targetUdid) {
      return res.status(400).json({ success: false, message: 'Valid device UDID is required for Apple MDM lock' });
    }

    const mdmResult = await enqueueDeviceLock(targetUdid, pinCode);
    
    if (mdmResult.success) {
      // Update local device state if available
      await Device.updateOne({ mdmUdid: targetUdid }, { isLocked: true });
      return res.json({ success: true, message: 'Apple MDM Lock command enqueued successfully', result: mdmResult.data });
    } else {
      return res.status(502).json({ success: false, message: 'Failed to enqueue NanoMDM lock command', error: mdmResult.error });
    }
  } catch (error) {
    console.error('❌ [MDM Lock Error]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/mdm/unlock
 * @desc    Enqueue an Unlock / Clear Passcode command for an iOS device
 * @access  Private / Shopkeeper / Admin
 */
router.post('/unlock', async (req, res) => {
  try {
    const { deviceId, udid } = req.body;

    let targetUdid = udid;
    if (!targetUdid && deviceId) {
      const device = await Device.findById(deviceId);
      if (device) {
        targetUdid = device.mdmUdid;
      }
    }

    if (!targetUdid) {
      return res.status(400).json({ success: false, message: 'Valid device UDID is required for Apple MDM unlock' });
    }

    const mdmResult = await enqueueDeviceUnlock(targetUdid);
    
    if (mdmResult.success) {
      await Device.updateOne({ mdmUdid: targetUdid }, { isLocked: false });
      return res.json({ success: true, message: 'Apple MDM Unlock command enqueued successfully', result: mdmResult.data });
    } else {
      return res.status(502).json({ success: false, message: 'Failed to enqueue NanoMDM unlock command', error: mdmResult.error });
    }
  } catch (error) {
    console.error('❌ [MDM Unlock Error]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/mdm/profile/:key
 * @desc    Generate & download dynamic .mobileconfig enrollment profile for a given activation key
 * @access  Public
 */
router.get('/profile/:key', async (req, res) => {
  try {
    const activationKeyStr = req.params.key;
    const actKey = await ActivationKey.findOne({ key: activationKeyStr });

    const customerName = actKey ? (actKey.customerName || 'Vajra User') : 'Vajra User';

    const profileData = generateEnrollmentProfile({
      activationKey: activationKeyStr,
      customerName,
    });

    if (!profileData.success) {
      return res.status(500).json({ success: false, error: profileData.error });
    }

    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', `attachment; filename="${profileData.filename}"`);
    return res.send(profileData.xml);
  } catch (error) {
    console.error('❌ [MDM Profile Error]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/mdm/health
 * @desc    Check status of NanoMDM integration engine
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const nanoHealth = await checkNanoMdmHealth();
    return res.json({
      success: true,
      service: 'Vajra Apple MDM Router',
      nanoMdmStatus: nanoHealth,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
