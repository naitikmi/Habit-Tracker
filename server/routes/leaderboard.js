const express = require('express');
const mongoose = require('mongoose');
const Progress = require('../models/Progress');
const Follow = require('../models/Follow');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/:challengeId', authMiddleware, async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    const source = req.query.source || 'default';
    if (!challengeId) return res.json({ ok: false, error: 'Invalid challenge ID' });

    const query = { id: challengeId };
    if (source === 'default') query.type = 'default';
    else if (source === 'user') query.type = 'user';
    else query.type = 'group';

    const challenge = await Challenge.findOne(query).sort({ _id: -1 }).lean();
    if (!challenge) return res.json({ ok: false, error: 'Challenge not found' });

    const habitMaxMap = {};
    for (const h of challenge.habits) {
      habitMaxMap[h.id] = h.maxPoints || 10;
    }
    const habitMaxSum = Object.values(habitMaxMap).reduce((s, v) => s + v, 0);

// Only users who explicitly follow this challenge appear on its leaderboard —
    // having progress on it or having it as your active challenge isn't enough on its own.
    const followers = await Follow.find({ challengeId, source }).lean();
    const followerUserIds = followers.map(f => f.user.toString());

    // Get progress for just those followers
    const progressDocs = await Progress.find({ challengeId, user: { $in: followers.map(f => f.user) } }).lean();

    // Build a map of userId -> progress data
    const progressMap = {};
    for (const doc of progressDocs) {
      progressMap[doc.user.toString()] = doc.entries || {};
    }

    const entries = [];
    for (const userId of followerUserIds) {
      const user = await User.findById(userId).lean();
      if (!user) continue;

      const data = progressMap[userId] || {};

      const dateSet = new Set();
      let totalEarned = 0;
      for (const habitId of Object.keys(data)) {
        const dateMap = data[habitId];
        if (typeof dateMap === 'object' && dateMap !== null) {
          for (const dateStr of Object.keys(dateMap)) {
            dateSet.add(dateStr);
            const val = Number(dateMap[dateStr]) || 0;
            if (val > 0) {
              totalEarned += habitMaxMap[habitId] || 10;
            }
          }
        }
      }

      const daysTracked = dateSet.size;
      const totalPossible = daysTracked * (habitMaxSum || 1);
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
