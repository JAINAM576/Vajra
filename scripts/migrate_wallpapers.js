/**
 * Vajra Lock App — Wallpaper Migration Script
 * Generates personalised wallpapers for all existing shopkeepers
 * and uploads them to Cloudinary.
 *
 * Usage: node scripts/migrate_wallpapers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Shopkeeper = require('../models/Shopkeeper');
const { generateAndUploadWallpaper } = require('../utils/wallpaper');

const BATCH_SIZE = 5; // process in small batches to avoid Cloudinary rate limits

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.\n');

    // Find shopkeepers without a Cloudinary wallpaper
    // Re-generate for ALL active shopkeepers (layout update)
    const shopkeepers = await Shopkeeper.find({
      isDeleted: { $ne: true },
    }).lean();

    console.log(`📋 Found ${shopkeepers.length} shopkeeper(s) needing wallpaper generation.\n`);

    if (shopkeepers.length === 0) {
      console.log('✨ Nothing to migrate. All shopkeepers already have custom wallpapers.');
      await mongoose.disconnect();
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < shopkeepers.length; i += BATCH_SIZE) {
      const batch = shopkeepers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`── Batch ${batchNum} (${batch.length} shopkeepers) ──`);

      const promises = batch.map(async (sk) => {
        try {
          const url = await generateAndUploadWallpaper(
            sk.shopName,
            sk.mobileNo,
            sk._id.toString()
          );

          await Shopkeeper.updateOne(
            { _id: sk._id },
            { $set: { wallpaperUrl: url } }
          );

          console.log(`  ✅ ${sk.shopName} (${sk.mobileNo}) → ${url}`);
          successCount++;
        } catch (err) {
          console.error(`  ❌ ${sk.shopName} (${sk.mobileNo}) — ${err.message}`);
          failCount++;
        }
      });

      await Promise.all(promises);

      // Brief pause between batches to respect rate limits
      if (i + BATCH_SIZE < shopkeepers.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`\n── Migration Complete ──`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed:  ${failCount}`);
    console.log(`  📊 Total:   ${shopkeepers.length}`);

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
