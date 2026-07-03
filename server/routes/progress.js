const express = require('express');
const mongoose = require('mongoose');
const Progress = require('../models/Progress');
const ActiveChallenge = require('../models/ActiveChallenge');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const ac = await ActiveChallenge.findOne({ user: userId });
  if (!ac) return res.json({ ok: true, data: {} });
  const progress = await Progress.findOne({ user: userId, challengeId: ac.challengeId });
  res.json({ ok: true, data: progress ? progress.entries : {} });
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const ac = await ActiveChallenge.findOne({ user: userId });
    if (!ac) return res.status(400).json({ ok: false, error: 'No active challenge' });
    await Progress.findOneAndUpdate(
      { user: userId, challengeId: ac.challengeId },
      { entries: req.body.data || {} },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
