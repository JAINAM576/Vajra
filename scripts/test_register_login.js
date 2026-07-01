/**
 * Test: Register a new shopkeeper then immediately login.
 * Verifies the double-hashing bug is fixed.
 *
 * Usage: node scripts/test_register_login.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Shopkeeper = require('../models/Shopkeeper');
const bcrypt = require('bcryptjs');

const TEST_MOBILE = '9999000001';
const TEST_PASSWORD = 'test123456';

async function test() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.\n');

    // Clean up any previous test user
    await Shopkeeper.deleteOne({ mobileNo: TEST_MOBILE });

    // Simulate registration (same as auth.js route now does)
    console.log('📝 Registering test shopkeeper...');
    const shopkeeper = await Shopkeeper.create({
      shopkeeperName: 'Test User',
      shopName: 'Test Shop',
      location: 'Test City',
      mobileNo: TEST_MOBILE,
      password: TEST_PASSWORD, // plain password — pre-save hook should hash it once
      aadhaarNo: '',
      gmail: '',
    });

    console.log(`   Created: ${shopkeeper.shopkeeperName} (${shopkeeper.mobileNo})`);
    console.log(`   Stored hash: ${shopkeeper.password}`);
    console.log(`   Hash starts with $2a$ or $2b$: ${shopkeeper.password.startsWith('$2')}`);

    // Simulate login (same as auth.js login route does)
    console.log('\n🔐 Testing login with bcrypt.compare...');
    const isMatch = await bcrypt.compare(TEST_PASSWORD, shopkeeper.password);
    console.log(`   bcrypt.compare("${TEST_PASSWORD}", hash) = ${isMatch}`);

    if (isMatch) {
      console.log('\n✅ SUCCESS! Register → Login flow works correctly.');
    } else {
      console.log('\n❌ FAILED! Password comparison did not match. Double-hashing may still exist.');
    }

    // Also test via the model's comparePassword method
    const isMatchModel = await shopkeeper.comparePassword(TEST_PASSWORD);
    console.log(`   shopkeeper.comparePassword() = ${isMatchModel}`);

    // Clean up test user
    await Shopkeeper.deleteOne({ mobileNo: TEST_MOBILE });
    console.log('\n🧹 Cleaned up test user.');

    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  } catch (err) {
    console.error('❌ Test error:', err);
    process.exit(1);
  }
}

test();
