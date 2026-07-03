const express = require('express');
const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
const ActiveChallenge = require('../models/ActiveChallenge');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get default challenges (public) — returns as { challenges, nextChallengeId }
router.get('/default', async (req, res) => {
  const challenges = await Challenge.find({ type: 'default' }).sort({ _id: 1 }).lean();
  const maxId = challenges.reduce((m, c) => Math.max(m, c.id || 0), 0);
  res.json({ ok: true, data: { challenges, nextChallengeId: maxId + 1 } });
});

// Save/replace default challenges (admin only)
router.post('/default', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { challenges } = req.body.data || {};
    await Challenge.deleteMany({ type: 'default' });
    if (challenges && challenges.length) {
      const docs = challenges.map(c => ({
        type: 'default', owner: null,
        id: c.id, name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits || [],
        nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
      }));
      await Challenge.insertMany(docs);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get user challenges — returns as { challenges, nextChallengeId }
router.get('/user', authMiddleware, async (req, res) => {
  const challenges = await Challenge.find({ type: 'user', owner: new mongoose.Types.ObjectId(req.user.id) }).sort({ _id: 1 }).lean();
  const maxId = challenges.reduce((m, c) => Math.max(m, c.id || 0), 0);
  res.json({ ok: true, data: { challenges, nextChallengeId: maxId + 1 } });
});

// Save/replace user challenges
router.post('/user', authMiddleware, async (req, res) => {
  try {
    const { challenges } = req.body.data || {};
    await Challenge.deleteMany({ type: 'user', owner: new mongoose.Types.ObjectId(req.user.id) });
    if (challenges && challenges.length) {
      const docs = challenges.map(c => ({
        type: 'user', owner: new mongoose.Types.ObjectId(req.user.id),
        id: c.id, name: c.name, days: c.days, startDate: c.startDate,
        habits: c.habits || [],
        nextHabitId: c.nextHabitId || (c.habits ? c.habits.length + 1 : 1)
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
  const ac = await ActiveChallenge.findOne({ user: new mongoose.Types.ObjectId(req.user.id) });
  res.json({ ok: true, data: ac ? { challengeId: ac.challengeId, source: ac.source } : null });
});

router.post('/active', authMiddleware, async (req, res) => {
  try {
    const { challengeId, source } = req.body;
    await ActiveChallenge.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(req.user.id) },
      { challengeId, source },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get all challenges for discovery (defaults + all user challenges)
router.get('/community', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const [defaults, userChallenges, active] = await Promise.all([
      Challenge.find({ type: 'default' }).sort({ _id: 1 }).lean(),
      Challenge.find({ type: 'user' }).populate('owner', 'username profilePicture').sort({ _id: 1 }).lean(),
      ActiveChallenge.findOne({ user: userId })
    ]);

    const following = active ? { id: active.challengeId, source: active.source } : null;

    const all = [
      ...defaults.map(c => ({
        id: c.id, name: c.name, days: c.days, habitsCount: c.habits.length,
        source: 'default', creator: null,
        following: following && following.source === 'default' && following.id === c.id
      })),
      ...userChallenges.map(c => ({
        id: c.id, name: c.name, days: c.days, habitsCount: c.habits.length,
        source: 'user', creator: c.owner ? { username: c.owner.username, profilePicture: c.owner.profilePicture || '' } : { username: 'Unknown' },
        following: following && following.source === 'user' && following.id === c.id,
        isOwn: c.owner && c.owner._id && String(c.owner._id) === req.user.id
      }))
    ];

    res.json({ ok: true, data: all });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
