const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let adminInitialized = false;
let initError = null;
let initMethod = 'none';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(keyPath)) {
  try {
    const serviceAccount = require(keyPath);
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    adminInitialized = true;
    initMethod = 'serviceAccountKey.json';
    console.log('✅ Firebase Admin initialized successfully (via serviceAccountKey.json)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin via serviceAccountKey.json:', err.message);
    adminInitialized = false;
  }
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    admin.initializeApp({
      credential: admin.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: privateKey.replace(/\\n/g, '\n')
      })
    });
    adminInitialized = true;
    console.log('✅ Firebase Admin initialized successfully (via Environment Variables)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin via Environment Variables:', err.message);
    adminInitialized = false;
  }
} else {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      // Robust parsing of private key (handle quotes, newlines, double-slashes)
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.cert({
          project_id: projectId,
          client_email: clientEmail,
          private_key: privateKey
        })
      });
      adminInitialized = true;
      initMethod = 'Environment Variables';
      console.log('✅ Firebase Admin initialized successfully (via Environment Variables)');
    } catch (err) {
      console.error('❌ Failed to initialize Firebase Admin via Environment Variables:', err.message);
      adminInitialized = false;
      initError = err.message;
    }
  } else {
    const missing = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    
    const errMsg = `FCM not initialized — missing environment variables: ${missing.join(', ')}`;
    console.log(`⚠️ ${errMsg}`);
    initError = errMsg;
  }
}

/**
 * Get the current FCM initialization status
 */
function getFcmStatus() {
  return {
    initialized: adminInitialized,
    method: initMethod,
    error: initError,
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || null,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  };
}

/**
 * Send a command to a device via FCM push notification
 * @param {string} fcmToken
 * @param {string} command
 * @param {object} extraData
 */
async function sendCommand(fcmToken, command, extraData = {}) {
  if (!adminInitialized) {
    console.warn(`FCM not initialized — skipping FCM dispatch for command: ${command}`);
    return { success: false, error: 'FCM not initialized' };
  }

  try {
    const message = {
      token: fcmToken,
      data: Object.assign({ command }, extraData),
      android: {
        priority: 'high',
        ttl: 60000
      }
    };

    const response = await getMessaging().send(message);
    console.log(`✅ FCM command successfully sent: ${command} → response ID: ${response}`);
    return { success: true, messageId: response };

  } catch (error) {
    console.error(`❌ FCM dispatch error for command ${command}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendCommand, getFcmStatus };
