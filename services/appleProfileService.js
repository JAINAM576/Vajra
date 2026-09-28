/**
 * Apple MDM Profile (.mobileconfig) Generator Service
 * Generates dynamic iOS enrollment profiles embedded with activation keys.
 */

const NANOMDM_URL = process.env.NANOMDM_URL || 'https://lockapp-server.onrender.com';
const APNS_TOPIC = process.env.APNS_TOPIC || 'com.apple.mgmt.External.be05adf5-a3e2-4bf7-8b83-9020f9e5fcc4';

/**
 * Generate an unsigned XML enrollment .mobileconfig profile string.
 * @param {Object} options
 * @param {string} options.activationKey - Customer activation key
 * @param {string} options.customerName - Customer name
 * @param {string} [options.serverUrl] - NanoMDM check-in server URL
 */
function generateEnrollmentProfile({ activationKey, customerName, serverUrl }) {
  try {
    const checkInUrl = (serverUrl || NANOMDM_URL).replace(/\/$/, '');
    const payloadUuid = `vajra-mdm-enrollment-${activationKey || 'generic'}`;

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.mdm</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.vajra.lockapp.mdm</string>
      <key>PayloadUUID</key>
      <string>${payloadUuid}</string>
      <key>PayloadDisplayName</key>
      <string>Vajra Device Management</string>
      <key>PayloadDescription</key>
      <string>Configures Vajra MDM Device Security and Lock Management.</string>
      <key>PayloadOrganization</key>
      <string>Vajra Mobile Security</string>
      <key>ServerURL</key>
      <string>${checkInUrl}/mdm</string>
      <key>CheckInURL</key>
      <string>${checkInUrl}/mdm</string>
      <key>AccessRights</key>
      <integer>8191</integer>
      <key>Topic</key>
      <string>${APNS_TOPIC}</string>
      <key>SignMessage</key>
      <true/>
      <key>CheckOutWhenRemoved</key>
      <true/>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>Vajra Management Profile - ${customerName || 'Customer'}</string>
  <key>PayloadIdentifier</key>
  <string>com.vajra.lockapp.profile.${activationKey || 'default'}</string>
  <key>PayloadOrganization</key>
  <string>Vajra Mobile Security</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>profile-root-${payloadUuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

    return {
      success: true,
      xml: xmlPayload,
      filename: `Vajra_Enrollment_${activationKey || 'Device'}.mobileconfig`,
    };
  } catch (error) {
    console.error('[AppleProfileService] Error generating profile:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  generateEnrollmentProfile,
};
