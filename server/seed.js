const mongoose = require('mongoose');
const User = require('./models/User');

async function seedAdmin() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/habit-tracker';
  await mongoose.connect(uri);
  const existing = await User.findOne({ username: 'naitikmishra' });
  if (existing) {
    existing.role = 'admin';
    if (!existing.email) existing.email = 'naitik@admin.com';
    await existing.save();
  } else {
    await User.create({ username: 'naitikmishra', email: 'naitik@admin.com', password: 'Naitik', role: 'admin' });
  }
  console.log('Admin seeded');
  await mongoose.disconnect();
}

seedAdmin().catch(e => { console.error(e); process.exit(1); });
