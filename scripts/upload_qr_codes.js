/**
 * Script to upload TestDPC and LockApp QR code images from images/ directory to Cloudinary
 * and save their secure Cloudinary URLs into SystemConfig database.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const connectDB = require('../config/db');
const SystemConfig = require('../models/SystemConfig');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DPC_QR_PATH = path.join(__dirname, '..', 'images', 'dpc_qr.png');
const APP_QR_PATH = path.join(__dirname, '..', 'images', 'apk_download_qr.png');

async function uploadQrCodes() {
  console.log('--- Uploading QR Codes to Cloudinary ---');

  await connectDB();

  let testDpcQrUrl = '';
  let deviceOwnerQrUrl = '';

  // 1. Upload TestDPC QR Code
  if (fs.existsSync(DPC_QR_PATH)) {
    console.log('Uploading dpc_qr.png to Cloudinary...');
    const dpcResult = await cloudinary.uploader.upload(DPC_QR_PATH, {
      folder: 'lockapp_qr',
      public_id: 'testdpc_qr',
      overwrite: true,
    });
    testDpcQrUrl = dpcResult.secure_url;
    console.log('✅ TestDPC QR uploaded:', testDpcQrUrl);
  } else {
    console.warn('⚠️ dpc_qr.png not found at:', DPC_QR_PATH);
  }

  // 2. Upload LockApp Download QR Code
  if (fs.existsSync(APP_QR_PATH)) {
    console.log('Uploading apk_download_qr.png to Cloudinary...');
    const appResult = await cloudinary.uploader.upload(APP_QR_PATH, {
      folder: 'lockapp_qr',
      public_id: 'apk_download_qr',
      overwrite: true,
    });
    deviceOwnerQrUrl = appResult.secure_url;
    console.log('✅ LockApp QR uploaded:', deviceOwnerQrUrl);
  } else {
    console.warn('⚠️ apk_download_qr.png not found at:', APP_QR_PATH);
  }

  // 3. Update SystemConfig Database
  const updates = {};
  if (testDpcQrUrl) updates.testDpcQrUrl = testDpcQrUrl;
  if (deviceOwnerQrUrl) updates.deviceOwnerQrUrl = deviceOwnerQrUrl;

  if (Object.keys(updates).length > 0) {
    const config = await SystemConfig.findOneAndUpdate(
      { configKey: 'platform' },
      { $set: updates },
      { new: true, upsert: true }
    );
    console.log('\n✅ SystemConfig updated successfully in database:');
    console.log('   testDpcQrUrl:', config.testDpcQrUrl);
    console.log('   deviceOwnerQrUrl:', config.deviceOwnerQrUrl);
  } else {
    console.log('⚠️ No updates made to SystemConfig.');
  }

  process.exit(0);
}

uploadQrCodes().catch((err) => {
  console.error('❌ Upload script failed:', err.message);
  console.error(err);
  process.exit(1);
});
