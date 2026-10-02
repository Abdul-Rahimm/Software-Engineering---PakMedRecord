// Usage: npm run create-admin -- <email> "<name>" <password>
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { connection_string } = require('../config');
const Admin = require('../models/AdminModel');

(async () => {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 10) {
    console.error('Usage: npm run create-admin -- <email> "<name>" <password (10+ chars)>');
    process.exit(1);
  }
  await mongoose.connect(connection_string);
  const admin = await Admin.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), name, password: await bcrypt.hash(password, 10) },
    { upsert: true, new: true }
  );
  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
