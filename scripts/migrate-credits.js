/**
 * Migration Script — Credit Bifurcation
 * Populates androidCredits and iosCredits for existing Shopkeepers
 * Sets platform = 'android' on existing CreditTransactions
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Adjust relative path to .env if present

const Shopkeeper = require('../models/Shopkeeper');
const CreditTransaction = require('../models/CreditTransaction');

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lockapp';
  console.log('Connecting to MongoDB at:', mongoUri);
  await mongoose.connect(mongoUri);

  console.log('Starting credit bifurcation migration...');

  // 1. Migrate Shopkeepers
  const shopkeepers = await Shopkeeper.find({});
  let skUpdated = 0;

  for (const sk of shopkeepers) {
    let modified = false;
    if (sk.androidCredits === undefined || sk.androidCredits === 0 && (sk.credits || 0) > 0) {
      sk.androidCredits = sk.credits || 0;
      sk.iosCredits = 0;
      sk.totalAndroidCreditsUsed = sk.totalCreditsUsed || 0;
      sk.totalIosCreditsUsed = 0;
      modified = true;
    }
    if (modified) {
      await sk.save();
      skUpdated++;
    }
  }

  console.log(`Migrated ${skUpdated} shopkeepers.`);

  // 2. Migrate CreditTransactions
  const transactions = await CreditTransaction.find({ platform: { $exists: false } });
  let txUpdated = 0;

  for (const tx of transactions) {
    tx.platform = 'android';
    await tx.save();
    txUpdated++;
  }

  console.log(`Migrated ${txUpdated} credit transactions.`);

  console.log('Migration completed successfully.');
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = migrate;
