require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('../models/Device');
const Shopkeeper = require('../models/Shopkeeper');

async function test() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    // Let's find one shopkeeper to test with
    const shopkeeper = await Shopkeeper.findOne({});
    if (!shopkeeper) {
      console.log('No shopkeepers found in DB!');
      process.exit(0);
    }
    console.log('Testing with shopkeeper ID:', shopkeeper._id);

    const baseFilter = { isDeleted: { $ne: true }, shopkeeperId: shopkeeper._id };

    console.log('Fetching all devices...');
    const allDevices = await Device.find(baseFilter)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Fetched ${allDevices.length} devices.`);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

    let onlineCount = 0;
    let lockedCount = 0;
    let emiDueCount = 0;
    let emiLowCount = 0;
    let recentCount = 0;
    let totalEmiPending = 0;

    const remindersList = [];

    for (const d of allDevices) {
      const lastSeen = d.lastSeen ? new Date(d.lastSeen) : null;
      const isDeviceOnline = d.isOnline === true || (lastSeen && (now.getTime() - lastSeen.getTime()) < OFFLINE_THRESHOLD_MS);
      if (isDeviceOnline) onlineCount++;

      if (d.isLocked) lockedCount++;

      const totalEmis = d.totalEmis || 0;
      const paidEmis = d.paidEmis || 0;
      const emiAmount = d.emiAmount || 0;
      const emiRemaining = d.emiRemaining || 0;

      if (emiRemaining > 0) totalEmiPending += emiRemaining;

      const purchaseDateVal = d.purchaseDate || d.registeredAt || d.createdAt;
      const purchaseDate = purchaseDateVal ? new Date(purchaseDateVal) : null;

      if (!d.isCompleted && totalEmis > 0 && paidEmis < totalEmis && purchaseDate) {
        const nextDueMonth = paidEmis + 1;
        const nextDueDate = new Date(purchaseDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + nextDueMonth);

        const isOverdue = now > nextDueDate;
        const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (isOverdue || daysUntilDue <= 7) {
          emiDueCount++;

          let reminderStatus = 'upcoming';
          let reminderMessage = '';
          if (isOverdue) {
            reminderStatus = 'overdue';
            const daysBehind = Math.abs(daysUntilDue);
            reminderMessage = `${d.customerName}'s EMI of Rs ${emiAmount} is ${daysBehind} day(s) overdue.`;
          } else if (daysUntilDue <= 0) {
            reminderStatus = 'today';
            reminderMessage = `${d.customerName}'s EMI of Rs ${emiAmount} is due today.`;
          } else {
            reminderStatus = 'upcoming';
            reminderMessage = `${d.customerName}'s EMI of Rs ${emiAmount} is due in ${daysUntilDue} day(s).`;
          }

          remindersList.push({
            id: d._id.toString(),
            customerName: d.customerName,
            customerMobile: d.customerMobile,
            emiAmount,
            status: reminderStatus,
            message: reminderMessage,
            device: d,
          });
        }
      }

      if (!d.isCompleted && totalEmis > 0 && paidEmis > 0 && (paidEmis / totalEmis) < 0.5) {
        emiLowCount++;
      }

      const createdAt = d.createdAt ? new Date(d.createdAt) : null;
      if (createdAt && createdAt >= sevenDaysAgo) {
        recentCount++;
      }
    }

    const totalDevices = allDevices.length;
    console.log('Computed stats successfully:', {
      totalDevices,
      onlineCount,
      lockedCount,
      emiDueCount,
      emiLowCount,
      recentCount,
      totalEmiPending,
    });

    const paginatedDevices = allDevices.slice(0, 20);

    console.log('Testing Device.populate...');
    const populatedDevices = await Device.populate(paginatedDevices, {
      path: 'shopkeeperId',
      select: 'shopkeeperName shopName',
    });
    console.log('Populated successfully! Example:', populatedDevices[0]);

    console.log('All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during test execution:', error);
    process.exit(1);
  }
}

test();
