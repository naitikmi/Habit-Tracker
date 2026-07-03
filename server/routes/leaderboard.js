const express = require('express');
const mongoose = require('mongoose');
const Progress = require('../models/Progress');
const Challenge = require('../models/Challenge');
const User = require('../models/User');

const router = express.Router();

router.get('/:challengeId', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    const source = req.query.source || 'default';
    if (isNaN(challengeId)) return res.json({ ok: false, error: 'Invalid challenge ID' });

    const query = { id: challengeId };
    if (source === 'default') query.type = 'default';
    else query.type = 'user';

    const challenge = await Challenge.findOne(query).sort({ _id: -1 }).lean();
    if (!challenge) return res.json({ ok: false, error: 'Challenge not found' });

    const habitMaxSum = challenge.habits.reduce((s, h) => s + (h.maxPoints || 10), 0);
    if (habitMaxSum === 0) return res.json({ ok: true, data: { challenge: { name: challenge.name, days: challenge.days, habitsCount: challenge.habits.length }, entries: [], count: 0 } });

    const progressDocs = await Progress.find({ challengeId }).lean();

    const entries = [];
    for (const doc of progressDocs) {
      const user = await User.findById(doc.user).lean();
      if (!user) continue;

      const data = doc.entries || {};

      const dateSet = new Set();
      let totalEarned = 0;
      for (const habitId of Object.keys(data)) {
        const dateMap = data[habitId];
        if (typeof dateMap === 'object' && dateMap !== null) {
          for (const dateStr of Object.keys(dateMap)) {
            dateSet.add(dateStr);
            totalEarned += Number(dateMap[dateStr]) || 0;
          }
        }
      }

      const daysTracked = dateSet.size;
      const totalPossible = daysTracked * habitMaxSum;
      const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

      entries.push({
        username: user.username,
        profilePicture: user.profilePicture || '',
        totalEarned,
        totalPossible,
        daysTracked,
        percentage
      });
    }

    entries.sort((a, b) => b.percentage - a.percentage || b.totalEarned - a.totalEarned);

    res.json({
      ok: true,
      data: {
        challenge: { name: challenge.name, days: challenge.days, habitsCount: challenge.habits.length },
        entries,
        count: entries.length
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
