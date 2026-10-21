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
    const certUuid = `vajra-cert-identity-${activationKey || 'generic'}`;

    // Base64 DER of identity certificate
    const certBase64 = process.env.MDM_CERT_BASE64 || 'MIIFdjCCBF6gAwIBAgIIBVKBjfJnkD8wDQYJKoZIhvcNAQELBQAwgYwxQDA+BgNVBAMMN0FwcGxlIEFwcGxpY2F0aW9uIEludGVncmF0aW9uIDIgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzAeFw0yNjA5MTkxMDUxMTlaFw0yNzA5MTkxMDUxMThaMIGPMUwwSgYKCZImiZPyLGQBAQw8Y29tLmFwcGxlLm1nbXQuRXh0ZXJuYWwuYmUwNWFkZjUtYTNlMi00YmY3LThiODMtOTAyMGY5ZTVmY2M0MTIwMAYDVQQDDClBUFNQOmJlMDVhZGY1LWEzZTItNGJmNy04YjgzLTkwMjBmOWU1ZmNjNDELMAkGA1UEBhMCSU4wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDryzl44vF5C1XyTrxEtst8vgVcSKfpMHgh0nKAJXQmvANnvF5KYjTI+z+D/vcXujWOSBrM/nV8wnEd5XLH7PMyZAZdWyzkaDBrUQZNQKGOVRWfJeEwF6eJ+Am1850d0kpFyt90xVJ2QS8dwZ9ee4omzVsMchqPbMudLBgrCn2czMnli1BCToTIqFfM14sK6gk8uWuDoDpiVqLlSGidVWYkqyMW4CHe0MZDC0MOD2yrp2CqCEnsaGkfCZV7oHX/c4xgNcxUo3UXfcXlBT/V6RstcstH/P2h8QSf/kf5hj3bJSdXReruF34ym4egQdV7mUOJUzzb+VR3FyHX0/trocFJAgMBAAGjggHVMIIB0TAJBgNVHRMEAjAAMB8GA1UdIwQYMBaAFPe+fCFgkds9G3vYOjKBad+ebH+bMIIBHAYDVR0gBIIBEzCCAQ8wggELBgkqhkiG92NkBQEwgf0wgcMGCCsGAQUFBwICMIG2DIGzUmVsaWFuY2Ugb24gdGhpcyBjZXJ0aWZpY2F0ZSBieSBhbnkgcGFydHkgYXNzdW1lcyBhY2NlcHRhbmNlIG9mIHRoZSB0aGVuIGFwcGxpY2FibGUgc3RhbmRhcmQgdGVybXMgYW5kIGNvbmRpdGlvbnMgb2YgdXNlLCBjZXJ0aWZpY2F0ZSBwb2xpY3kgYW5kIGNlcnRpZmljYXRpb24gcHJhY3RpY2Ugc3RhdGVtZW50cy4wNQYIKwYBBQUHAgEWKWh0dHA6Ly93d3cuYXBwbGUuY29tL2NlcnRpZmljYXRlYXV0aG9yaXR5MBMGA1UdJQQMMAoGCCsGAQUFBwMCMDAGA1UdHwQpMCcwJaAjoCGGH2h0dHA6Ly9jcmwuYXBwbGUuY29tL2FhaTJjYS5jcmwwHQYDVR0OBBYEFE1oQaJSpd7BHbZ8O8wiB7/PvrqwMAsGA1UdDwQEAwIHgDAQBgoqhkiG92NkBgMCBAIFADANBgkqhkiG9w0BAQsFAAOCAQEAJ47KjqUxWmiOhRLcsKNv3njL99K18GK5Miu1f0dVZ7gsEczSVIgToS6Z9+gK+6uY6huScwpRsRDoArFv591XeMS39GXPPQZAub8vicVc7alhCriPzr+AiOis2zoPfKHg+ink2Xl0oxFDpUja7FN/WZNjgmNcWVN9XD1YX0oakSANrY8vmoBVF0MzOW77d5H5MesAJhG1EIkdYVhk2N27pOHHlvHd8jUaqJFc1GmPrO9JKl5c3/dUYwvC6TEhvcMxb6gZBQ91VykGgmDEy79T8HZ98aUGL4SuuIBEjfzwvAqlwbwzplXcGaZiKV+ANToZoZdUJKxOmQcYxNkHjZxt/w==';

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.security.pem</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.vajra.lockapp.cert</string>
      <key>PayloadUUID</key>
      <string>${certUuid}</string>
      <key>PayloadDisplayName</key>
      <string>Vajra Management Certificate</string>
      <key>PayloadDescription</key>
      <string>Identity certificate for Vajra MDM authentication</string>
      <key>PayloadOrganization</key>
      <string>Vajra Mobile Security</string>
      <key>PayloadContent</key>
      <data>${certBase64}</data>
    </dict>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.mdm</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>com.vajra.lockapp.mdm</string>
      <key>PayloadUUID</key>
      <string>${payloadUuid}</string>
      <key>IdentityCertificateUUID</key>
      <string>${certUuid}</string>
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
