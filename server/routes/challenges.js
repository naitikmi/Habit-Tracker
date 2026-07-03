const express = require('express');
const DataStore = require('../models/DataStore');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get default challenges (public)
router.get('/default', async (req, res) => {
  const doc = await DataStore.findOne({ key: 'default_challenges' });
  res.json({ ok: true, data: doc ? doc.value : null });
});

// Save default challenges (admin only)
router.post('/default', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await DataStore.findOneAndUpdate(
      { key: 'default_challenges' },
      { value: req.body.data },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get user challenges
router.get('/user', authMiddleware, async (req, res) => {
  const doc = await DataStore.findOne({ key: 'user_challenges_' + req.user.id });
  res.json({ ok: true, data: doc ? doc.value : null });
});

// Save user challenges
router.post('/user', authMiddleware, async (req, res) => {
  try {
    await DataStore.findOneAndUpdate(
      { key: 'user_challenges_' + req.user.id },
      { value: req.body.data },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Active challenge per user
router.get('/active', authMiddleware, async (req, res) => {
  const doc = await DataStore.findOne({ key: 'active_challenge_' + req.user.id });
  res.json({ ok: true, data: doc ? doc.value : null });
});

router.post('/active', authMiddleware, async (req, res) => {
  try {
    await DataStore.findOneAndUpdate(
      { key: 'active_challenge_' + req.user.id },
      { value: req.body },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
