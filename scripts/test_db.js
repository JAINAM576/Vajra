const mongoose = require('mongoose');

async function testConnection() {
  const localUris = [
    'mongodb://127.0.0.1:27017/vajra_lockapp',
    'mongodb://localhost:27017/vajra_lockapp'
  ];

  for (const uri of localUris) {
    try {
      console.log(`Trying to connect to ${uri}...`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log(`✅ Success! Connected to ${uri}`);
      await mongoose.disconnect();
      return uri;
    } catch (err) {
      console.log(`❌ Failed to connect to ${uri}: ${err.message}`);
    }
  }
  return null;
}

testConnection().then(result => {
  if (result) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
