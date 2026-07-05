require('dotenv').config();
const { sendCommand, getFcmStatus } = require('../services/fcm');

console.log('=== FCM Diagnostic Tool ===');
const status = getFcmStatus();
console.log('Status:');
console.log(JSON.stringify(status, null, 2));

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('\nUsage: node scripts/test_fcm.js <device_fcm_token> [command] [inputValue]');
  console.log('Example: node scripts/test_fcm.js "your_fcm_token_here" "lock"');
  console.log('Example: node scripts/test_fcm.js "your_fcm_token_here" "alert" "Hello from server"');
  process.exit(0);
}

const fcmToken = args[0];
const commandId = args[1] || 'lock';
const inputValue = args[2] || '';

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
const extraData = {};

if (inputValue) {
  if (commandId === 'set_pin') {
    extraData.pin = String(inputValue);
    extraData.value = String(inputValue);
  } else if (commandId === 'alert') {
    extraData.alert_message = String(inputValue);
    extraData.message = String(inputValue);
    extraData.value = String(inputValue);
  } else if (commandId === 'wallpaper') {
    extraData.wallpaper_url = String(inputValue);
    extraData.url = String(inputValue);
    extraData.value = String(inputValue);
  } else {
    extraData.value = String(inputValue);
  }
}

if (commandId === 'lock') {
  extraData.emi_amount = '1000';
  extraData.emi_due_date = new Date().toISOString().split('T')[0];
}

console.log(`\n🚀 Attempting to send command [${fcmCmd}] to token [${fcmToken.substring(0, 15)}...]`);
console.log('Extra data:', JSON.stringify(extraData, null, 2));

sendCommand(fcmToken, fcmCmd, extraData)
  .then(res => {
    if (res.success) {
      console.log('\n✅ SUCCESS! FCM message sent successfully.');
      console.log('Response ID:', res.messageId);
    } else {
      console.log('\n❌ FAILED! FCM message dispatch failed.');
      console.log('Error:', res.error);
    }
  })
  .catch(err => {
    console.error('\n❌ ERROR! Unexpected error occurred:', err.message);
  });
