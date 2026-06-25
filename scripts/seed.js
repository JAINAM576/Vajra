/**
 * Database Seed Script
 * Run with: npm run seed
 *
 * Creates initial admin accounts and platform config.
 * Safe to run multiple times — skips if data already exists.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');
const SystemConfig = require('../models/SystemConfig');

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log('\n🌱 Starting database seed...\n');

    // ─── Seed Super Admin ───
    const existingAdmin = await Admin.findOne({ adminId: 'admin1' });
    if (!existingAdmin) {
      await Admin.create({
        adminId: 'admin1',
        name: 'Parin Shah',
        email: 'admin@vajra.com',
        password: 'admin123', // Will be bcrypt hashed by pre-save hook
        role: 'super_admin',
      });
      console.log('✅ Super Admin created:');
      console.log('   Login ID: admin1');
      console.log('   Password: admin123');
      console.log('   ⚠️  Change this password in production!\n');
    } else {
      console.log('ℹ️  Super Admin already exists, skipping.\n');
    }

    // ─── Seed System Config (Singleton) ───
    const existingConfig = await SystemConfig.findOne({ configKey: 'platform' });
    if (!existingConfig) {
      await SystemConfig.create({
        configKey: 'platform',
        creditPriceINR: 1,
        paymentQrUrl: '', // Will be set via admin panel + Cloudinary upload later
        upiId: '',
        wallpaperTemplates: [],
        maintenanceMode: false,
        minAppVersion: '1.0.0',
      });
      console.log('✅ System Config created:');
      console.log('   Credit Price: ₹1 per credit');
      console.log('   Payment QR: (not set — upload via admin panel)');
      console.log('   Wallpapers: (none — upload via admin panel)\n');
    } else {
      console.log('ℹ️  System Config already exists, skipping.\n');
    }

    console.log('🎉 Seed complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
