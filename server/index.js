const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const progressRoutes = require('./routes/progress');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/progress', progressRoutes);

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.sendFile(path.join(clientBuild, 'index.html'));
});

async function start() {
  await connectDB();

  // Seed admin
  const existing = await User.findOne({ username: 'naitikmishra' });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
  } else {
    await User.create({ username: 'naitikmishra', password: 'Naitik', role: 'admin' });
  }
  console.log('Admin account ready');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(e => { console.error('Startup error:', e.message); process.exit(1); });
