/**
 * NanoMDM Integration Service
 * Speaks REST API to NanoMDM engine (Render / local) to enqueue Apple MDM commands.
 * All functions are safely wrapped in try-catch to prevent any backend failures.
 */

const crypto = require('crypto');

const NANOMDM_URL = process.env.NANOMDM_URL || 'http://localhost:8080';
const NANOMDM_API_KEY = process.env.NANOMDM_API || process.env.NANOMDM_API_KEY || 'default_secret_api_key';

/**
 * Helper method to execute HTTP requests to NanoMDM REST API safely using Basic Auth.
 */
async function callNanoMdmApi(endpoint, method = 'PUT', xmlBody = '') {
  try {
    const url = `${NANOMDM_URL.replace(/\/$/, '')}${endpoint}`;
    const authHeader = `Basic ${Buffer.from(`nanomdm:${NANOMDM_API_KEY}`).toString('base64')}`;

    const headers = {
      'Content-Type': 'application/xml',
      'Authorization': authHeader,
    };

    const options = {
      method,
      headers,
    };

    if (xmlBody && (method === 'POST' || method === 'PUT')) {
      options.body = xmlBody;
    }

    const response = await fetch(url, options);
    
    let resText;
    try {
      resText = await response.text();
    } catch (_) {
      resText = '';
    }

    if (!response.ok) {
      console.warn(`[NanoMDM] API returned non-200 status (${response.status}):`, resText);
      return {
        success: false,
        status: response.status,
        error: resText || `HTTP error ${response.status}`,
      };
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(resText);
    } catch (_) {}

    return {
      success: true,
      status: response.status,
      data: parsedJson || resText,
    };
  } catch (error) {
    console.error('[NanoMDM] Network / Call Exception:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper to build raw Apple MDM command Plist XML string.
 */
function buildMdmCommandPlist(requestType, params = {}) {
  const commandUuid = params.commandUuid || crypto.randomUUID();

  let paramsXml = '';
  if (requestType === 'DeviceLock') {
    if (params.pinCode) {
      paramsXml += `<key>PIN</key><string>${params.pinCode}</string>`;
    }
    if (params.message) {
      paramsXml += `<key>Message</key><string>${params.message}</string>`;
    }
  } else if (requestType === 'EraseDevice') {
    if (params.pinCode) {
      paramsXml += `<key>PIN</key><string>${params.pinCode}</string>`;
    }
  }

  return {
    commandUuid,
    plistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Command</key>
	<dict>
		<key>RequestType</key>
		<string>${requestType}</string>
		${paramsXml}
	</dict>
	<key>CommandUUID</key>
	<string>${commandUuid}</string>
</dict>
</plist>`,
  };
}

/**
 * Enqueue a DeviceLock command for an iOS device via NanoMDM.
 * @param {string} udid - Apple device UDID
 * @param {string} [pinCode] - Optional passcode/PIN for lock screen
 */
async function enqueueDeviceLock(udid, pinCode = '') {
  if (!udid) {
    return { success: false, error: 'Device UDID is required for Apple MDM lock' };
  }

  try {
    const { plistXml, commandUuid } = buildMdmCommandPlist('DeviceLock', { pinCode });
    const result = await callNanoMdmApi(`/v1/enqueue/${encodeURIComponent(udid)}`, 'PUT', plistXml);
    return { ...result, commandUuid };
  } catch (err) {
    console.error(`[NanoMDM] Exception in enqueueDeviceLock for UDID ${udid}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Enqueue an Unlock / Clear Passcode command for an iOS device.
 * @param {string} udid - Apple device UDID
 */
async function enqueueDeviceUnlock(udid) {
  if (!udid) {
    return { success: false, error: 'Device UDID is required for Apple MDM unlock' };
  }

  try {
    const { plistXml, commandUuid } = buildMdmCommandPlist('ClearPasscode');
    const result = await callNanoMdmApi(`/v1/enqueue/${encodeURIComponent(udid)}`, 'PUT', plistXml);
    return { ...result, commandUuid };
  } catch (err) {
    console.error(`[NanoMDM] Exception in enqueueDeviceUnlock for UDID ${udid}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Enqueue an EraseDevice (Remote Wipe) command for an iOS device.
 * @param {string} udid - Apple device UDID
 * @param {string} [pinCode] - Required for macOS/some iOS erase configurations
 */
async function enqueueDeviceErase(udid, pinCode = '') {
  if (!udid) {
    return { success: false, error: 'Device UDID is required for Apple MDM erase' };
  }

  try {
    const { plistXml, commandUuid } = buildMdmCommandPlist('EraseDevice', { pinCode });
    const result = await callNanoMdmApi(`/v1/enqueue/${encodeURIComponent(udid)}`, 'PUT', plistXml);
    return { ...result, commandUuid };
  } catch (err) {
    console.error(`[NanoMDM] Exception in enqueueDeviceErase for UDID ${udid}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check NanoMDM engine health status.
 */
async function checkNanoMdmHealth() {
  try {
    const result = await callNanoMdmApi('/version', 'GET');
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  callNanoMdmApi,
  enqueueDeviceLock,
  enqueueDeviceUnlock,
  enqueueDeviceErase,
  checkNanoMdmHealth,
};
