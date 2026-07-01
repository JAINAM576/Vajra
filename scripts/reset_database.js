/**
 * Vajra Lock App — Database Reset Script
 * Drops ALL collections and re-seeds the default admin user.
 *
 * Usage: node scripts/reset_database.js
 *
 * ⚠️  THIS IS DESTRUCTIVE — all data will be permanently deleted!
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const SystemConfig = require('../models/SystemConfig');

const DEFAULT_ADMIN = {
  adminId: 'admin1',
  name: 'Super Admin',
  email: 'admin@vajralock.com',
  password: 'admin123',       // plain — pre-save hook will hash it
  role: 'super_admin',
  isActive: true,
};

async function resetDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    console.log(`✅ Connected to database: ${dbName}\n`);

    // Drop every collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`🗑️  Dropping ${collections.length} collection(s)...`);
    for (const col of collections) {
      await mongoose.connection.db.dropCollection(col.name);
      console.log(`   ✓ Dropped: ${col.name}`);
    }

    // Re-seed admin
    console.log('\n🌱 Seeding default admin user...');
    const admin = await Admin.create(DEFAULT_ADMIN);
    console.log(`   ✓ Created admin: ${admin.adminId} (${admin.role})`);

    // Re-seed system config
    console.log('\n🌱 Seeding default system config...');
    const config = await SystemConfig.create({
      configKey: 'platform',
      creditPriceINR: 50,
      upiId: '',
      paymentQrUrl: '',
      maintenanceMode: false,
      minAppVersion: '1.0.0',
      wallpaperTemplates: [],
      updatedBy: admin._id,
    });
    console.log(`   ✓ Created platform config (creditPriceINR: ₹${config.creditPriceINR})`);

    console.log('\n══════════════════════════════════════');
    console.log('  ✅ DATABASE RESET COMPLETE');
    console.log('──────────────────────────────────────');
    console.log(`  Admin ID:       ${DEFAULT_ADMIN.adminId}`);
    console.log(`  Admin Password: ${DEFAULT_ADMIN.password}`);
    console.log('══════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  }
}

resetDatabase();
