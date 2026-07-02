const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let adminInitialized = false;
const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(keyPath)) {
  try {
    const serviceAccount = require(keyPath);
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    adminInitialized = true;
    console.log('✅ Firebase Admin initialized successfully (via serviceAccountKey.json)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin via serviceAccountKey.json:', err.message);
    adminInitialized = false;
  }
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    adminInitialized = true;
    console.log('✅ Firebase Admin initialized successfully (via Environment Variables)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin via Environment Variables:', err.message);
    adminInitialized = false;
  }
} else {
  console.log('⚠️ Firebase Admin could not be initialized — neither serviceAccountKey.json nor FIREBASE_* env variables were found. FCM push notifications are disabled.');
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

    const response = await admin.messaging().send(message);
    console.log(`✅ FCM command successfully sent: ${command} → response ID: ${response}`);
    return { success: true, messageId: response };

  } catch (error) {
    console.error(`❌ FCM dispatch error for command ${command}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendCommand };
