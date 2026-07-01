const mongoose = require('mongoose');

const uris = [
  "mongodb+srv://parinkvajra_db_user:bDQr6Z5i1zLZbS6g@cluster0.o1zaftt.mongodb.net/?appName=Cluster0",
  "mongodb+srv://parinkvajra_db_user:XoubijLKWhheFsOd@cluster0.o1zaftt.mongodb.net/?appName=Cluster0"
];

async function run() {
  for (const uri of uris) {
    try {
      console.log('Trying to connect to:', uri.replace(/:([^@]+)@/, ':****@'));
      await mongoose.connect(uri);
      console.log('✅ Successful connection!');
      console.log('Database name:', mongoose.connection.name);
      await mongoose.disconnect();
      return;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
    }
  }
}

run();
