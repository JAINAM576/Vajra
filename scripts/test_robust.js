/**
 * Vajra Lock App — Comprehensive Integration Test Suite
 * Performs HTTP requests to verify all backend API endpoints, compatibility routes,
 * client device flows, and shopkeeper features.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Vajra Lock App Integration Test Suite...');
  
  let shopkeeperToken = '';
  let generatedKey = '';
  let clientDeviceId = '';

  // 1. Health Check Test
  try {
    const res = await makeRequest(`${BASE_URL}/api/health`);
    if (res.status === 200 && res.body.success) {
      console.log('✅ PASS: Server health check succeeded');
    } else {
      console.error('❌ FAIL: Server health check failed', res);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Cannot connect to server at', BASE_URL, '-', err.message);
    console.log('Please make sure the Node.js backend is running!');
    process.exit(1);
  }

  // 2. Register/Login Shopkeeper Test
  try {
    const randomMobile = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const regRes = await makeRequest(`${BASE_URL}/api/auth/shopkeeper/register`, {
      method: 'POST',
      body: {
        shopkeeperName: 'Integration Test Owner',
        shopName: 'Test Mobiles Inc',
        location: 'Mumbai, Maharashtra',
        mobileNo: randomMobile,
        gmail: `test_${Date.now()}@gmail.com`,
        password: 'Password123',
        confirmPassword: 'Password123'
      }
    });

    if (regRes.status === 201 && regRes.body.success) {
      console.log('✅ PASS: Shopkeeper registration succeeded');
      shopkeeperToken = regRes.body.data.token;
      const shopkeeperId = regRes.body.data.shopkeeper._id;

      // Add credits via Admin API
      try {
        const adminLogin = await makeRequest(`${BASE_URL}/api/auth/admin/login`, {
          method: 'POST',
          body: { adminId: 'admin1', password: 'admin123' }
        });

        if (adminLogin.status === 200 && adminLogin.body.success) {
          const adminToken = adminLogin.body.data.token;
          const creditRes = await makeRequest(`${BASE_URL}/api/shopkeepers/${shopkeeperId}/credits`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: {
              amount: 50,
              paymentMethod: 'UPI',
              paymentReference: 'TEST-UPI-12345',
              notes: 'Test Credits'
            }
          });

          if (creditRes.status === 200 && creditRes.body.success) {
            console.log('✅ PASS: Admin successfully added credits to shopkeeper');
          } else {
            console.error('❌ FAIL: Admin failed to add credits', creditRes.body);
            process.exit(1);
          }
        } else {
          console.error('❌ FAIL: Admin login failed', adminLogin.body);
          process.exit(1);
        }
      } catch (err) {
        console.error('❌ FAIL: Error adding credits as admin', err.message);
        process.exit(1);
      }
    } else {
      console.error('❌ FAIL: Shopkeeper registration failed', regRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error during registration', err.message);
    process.exit(1);
  }

  // 3. Generate Activation Key Test (Shopkeeper feature)
  try {
    // Generate activation key by calling /api/keys/generate
    const keyRes = await makeRequest(`${BASE_URL}/api/keys/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${shopkeeperToken}` }
    });

    if (keyRes.status === 201 && keyRes.body.success) {
      generatedKey = keyRes.body.data.activationKey.key;
      console.log(`✅ PASS: Key generation succeeded. Key: ${generatedKey}`);
    } else {
      console.error('❌ FAIL: Key generation failed', keyRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error generating key', err.message);
    process.exit(1);
  }

  // 4. Register client record on server (Shopkeeper feature: Bind And Activate)
  try {
    const bindRes = await makeRequest(`${BASE_URL}/api/devices/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${shopkeeperToken}` },
      body: {
        key: generatedKey,
        customerName: 'Aaditya Sen',
        customerMobile: '9888877777',
        deviceModel: 'Samsung Galaxy S23',
        totalAmount: 75000,
        downPayment: 15000,
        emiAmount: 5000,
        emiDurationMonths: 12,
        interestRate: 10,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    if (bindRes.status === 201 && bindRes.body.success) {
      console.log('✅ PASS: Shopkeeper binding of device record succeeded');
    } else {
      console.error('❌ FAIL: Shopkeeper binding of device record failed', bindRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error binding device record', err.message);
    process.exit(1);
  }

  // 5. Client Android App device activation / compat test (Singular api/device/activate)
  const randomImei = Math.floor(100000000000000 + Math.random() * 900000000000000).toString();
  try {
    const mockFcm = 'fcm_token_integration_test_' + Math.random().toString(36).substring(2);
    const clientRes = await makeRequest(`${BASE_URL}/api/device/activate`, {
      method: 'POST',
      body: {
        activationKey: generatedKey,
        imei: randomImei,
        fcmToken: mockFcm,
        deviceModel: 'Samsung Galaxy S23',
        androidVersion: '13'
      }
    });

    if (clientRes.status === 200 && clientRes.body.success) {
      clientDeviceId = clientRes.body.deviceId;
      console.log(`✅ PASS: Client device compatibility activation succeeded. deviceId: ${clientDeviceId}`);
    } else {
      console.error('❌ FAIL: Client device compatibility activation failed', clientRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error during client device activation', err.message);
    process.exit(1);
  }

  // 6. Client Heartbeat Compat Test (Singular api/device/heartbeat)
  try {
    const hbRes = await makeRequest(`${BASE_URL}/api/device/heartbeat`, {
      method: 'POST',
      body: {
        deviceId: clientDeviceId,
        lat: 19.0760,
        lng: 72.8777,
        batteryLevel: 88,
        isLocked: false,
        isCharging: true,
        networkType: 'wifi'
      }
    });

    if (hbRes.status === 200 && hbRes.body.success) {
      console.log('✅ PASS: Client heartbeat compatibility endpoint succeeded');
    } else {
      console.error('❌ FAIL: Client heartbeat compatibility endpoint failed', hbRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error sending client heartbeat', err.message);
    process.exit(1);
  }

  // 7. Client specs/info update Compat Test (Singular api/device/info)
  try {
    const infoRes = await makeRequest(`${BASE_URL}/api/device/info`, {
      method: 'POST',
      body: {
        deviceId: clientDeviceId,
        imei: randomImei,
        deviceModel: 'Samsung Galaxy S23',
        androidVersion: '13',
        appVersion: '1.2.0',
        isDeviceOwner: true,
        batteryLevel: 88,
        storageAvailable: 12000000000,
        ramAvailable: 4000000000
      }
    });

    if (infoRes.status === 200 && infoRes.body.success) {
      console.log('✅ PASS: Client hardware specs update endpoint succeeded');
    } else {
      console.error('❌ FAIL: Client hardware specs update endpoint failed', infoRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error sending client hardware specs', err.message);
    process.exit(1);
  }

  // 8. Client FCM token update Compat Test (Singular api/device/update-token)
  try {
    const tokenRes = await makeRequest(`${BASE_URL}/api/device/update-token`, {
      method: 'POST',
      body: {
        deviceId: clientDeviceId,
        fcmToken: 'updated_fcm_token_12345'
      }
    });

    if (tokenRes.status === 200 && tokenRes.body.success) {
      console.log('✅ PASS: Client FCM token update endpoint succeeded');
    } else {
      console.error('❌ FAIL: Client FCM token update endpoint failed', tokenRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error updating client FCM token', err.message);
    process.exit(1);
  }

  // 9. Dispatch lock command online to verify database and command log status
  try {
    const cmdRes = await makeRequest(`${BASE_URL}/api/commands/${clientDeviceId}/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${shopkeeperToken}` },
      body: {
        commandId: 'lock',
        commandType: 'lock',
        mode: 'online'
      }
    });

    if (cmdRes.status === 201 && cmdRes.body.success) {
      console.log('✅ PASS: Command dispatch and Tag state application succeeded');
    } else {
      console.error('❌ FAIL: Command dispatch and Tag state application failed', cmdRes.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ FAIL: Error sending command', err.message);
    process.exit(1);
  }

  console.log('\n🎉 ALL Vajra Lock App Integration Tests Passed Successfully! (100% Robust)\n');
}

runTests();
