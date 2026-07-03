const express = require('express');
const Challenge = require('../models/Challenge');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get default challenges (public)
router.get('/default', async (req, res) => {
  const challenges = await Challenge.find({ type: 'default' });
  res.json({ ok: true, data: challenges });
});

// Save default challenges (admin only)
router.post('/default', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { challenges, activeChallengeId, nextChallengeId } = req.body.data || {};
    await Challenge.deleteMany({ type: 'default' });
    if (challenges) {
      const docs = challenges.map(c => ({
        type: 'default',
        name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits, nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
      }));
      await Challenge.insertMany(docs);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get user challenges
router.get('/user', authMiddleware, async (req, res) => {
  const challenges = await Challenge.find({ type: 'user', owner: req.user.id });
  res.json({ ok: true, data: challenges });
});

// Save user challenges
router.post('/user', authMiddleware, async (req, res) => {
  try {
    await Challenge.deleteMany({ type: 'user', owner: req.user.id });
    const { challenges } = req.body.data || {};
    if (challenges) {
      const docs = challenges.map(c => ({
        type: 'user', owner: req.user.id,
        name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits, nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
      }));
      await Challenge.insertMany(docs);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Active challenge per user
router.get('/active', authMiddleware, async (req, res) => {
  const ActiveChallenge = require('../models/ActiveChallenge');
  const ac = await ActiveChallenge.findOne({ user: req.user.id });
  res.json({ ok: true, data: ac });
});

router.post('/active', authMiddleware, async (req, res) => {
  try {
    const ActiveChallenge = require('../models/ActiveChallenge');
    const { challengeId, source } = req.body;
    await ActiveChallenge.findOneAndUpdate(
      { user: req.user.id },
      { challengeId, source },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
