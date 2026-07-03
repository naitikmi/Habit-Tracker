const mongoose = require('mongoose');
const User = require('./models/User');

async function seedAdmin() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/habit-tracker';
  await mongoose.connect(uri);
  const adminPassword = process.env.ADMIN_PASSWORD || (function(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'; let r=''; for(let i=0;i<12;i++) r+=c[Math.floor(Math.random()*c.length)]; return r; })();
  const existing = await User.findOne({ username: 'naitikmishra' });
  if (existing) {
    existing.role = 'admin';
    if (!existing.email) existing.email = 'naitik@admin.com';
    await existing.save();
  } else {
    await User.create({ username: 'naitikmishra', email: 'naitik@admin.com', password: adminPassword, role: 'admin' });
  }
  console.log('Admin seeded');
  if (!process.env.ADMIN_PASSWORD) console.log('Admin password:', adminPassword, '(set ADMIN_PASSWORD env to use a fixed password)');
  await mongoose.disconnect();
}

seedAdmin().catch(e => { console.error(e); process.exit(1); });
