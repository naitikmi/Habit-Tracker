const express = require('express');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const progressRoutes = require('./routes/progress');
const User = require('./models/User');
const Challenge = require('./models/Challenge');
const mongoose = require('mongoose');
const ActiveChallenge = require('./models/ActiveChallenge');

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

async function migrateFromDataStore() {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  if (!collections.some(c => c.name === 'datastores')) return;
  console.log('Migrating old DataStore data...');
  const oldData = await db.collection('datastores').find({}).toArray();
  for (const entry of oldData) {
    if (entry.key === 'default_challenges' && entry.value?.challenges?.length) {
      const challenges = entry.value.challenges.map(c => ({
        type: 'default', owner: null,
        id: c.id, name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits || [],
        nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
      }));
      await Challenge.insertMany(challenges);
      console.log(`Migrated ${challenges.length} default challenges`);
    }
    if (entry.key.startsWith('user_challenges_') && entry.value?.challenges?.length) {
      const userId = entry.key.replace('user_challenges_', '');
      const challenges = entry.value.challenges.map(c => ({
        type: 'user', owner: new mongoose.Types.ObjectId(userId),
        id: c.id, name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits || [],
        nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
      }));
      await Challenge.insertMany(challenges);
      console.log(`Migrated ${challenges.length} challenges for user ${userId}`);
    }
  }
  console.log('DataStore migration complete');
}

async function seedDefaultChallenges() {
  const count = await Challenge.countDocuments({ type: 'default' });
  if (count > 0) return;
  const defaults = [
    {
      name: '30-Day Fitness', days: 30, startDate: new Date().toISOString().slice(0, 10),
      habits: [
        { id: 1, name: 'Exercise 30 min', maxPoints: 10, color: '#ff8c42' },
        { id: 2, name: 'Drink 8 glasses water', maxPoints: 10, color: '#2ecc71' },
        { id: 3, name: '7+ hours sleep', maxPoints: 10, color: '#e74c3c' },
        { id: 4, name: 'Read 20 pages', maxPoints: 10, color: '#f39c12' }
      ], nextHabitId: 5
    },
    {
      name: 'Mindfulness Month', days: 30, startDate: new Date().toISOString().slice(0, 10),
      habits: [
        { id: 1, name: 'Meditate 10 min', maxPoints: 10, color: '#3498db' },
        { id: 2, name: 'Journal', maxPoints: 10, color: '#e91e63' },
        { id: 3, name: 'No social media 1hr', maxPoints: 10, color: '#2ecc71' },
        { id: 4, name: 'Gratitude list', maxPoints: 10, color: '#ff8c42' }
      ], nextHabitId: 5
    }
  ];
  await Challenge.insertMany(defaults.map(c => ({ ...c, type: 'default', owner: null })));
  console.log(`Seeded ${defaults.length} default challenges`);
}

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

  // Migrate from old DataStore format if present
  await migrateFromDataStore();
  // Seed default challenges if none exist
  await seedDefaultChallenges();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(e => { console.error('Startup error:', e.message); process.exit(1); });
