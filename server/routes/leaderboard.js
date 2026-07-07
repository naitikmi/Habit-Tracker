const express = require('express');
const mongoose = require('mongoose');
const Progress = require('../models/Progress');
const ActiveChallenge = require('../models/ActiveChallenge');
const Challenge = require('../models/Challenge');
const User = require('../models/User');

const router = express.Router();

router.get('/:challengeId', async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    const source = req.query.source || 'default';
    if (!challengeId) return res.json({ ok: false, error: 'Invalid challenge ID' });

    const query = { id: challengeId };
    if (source === 'default') query.type = 'default';
    else query.type = 'user';

    const challenge = await Challenge.findOne(query).sort({ _id: -1 }).lean();
    if (!challenge) return res.json({ ok: false, error: 'Challenge not found' });

    const habitMaxSum = challenge.habits.reduce((s, h) => s + (h.maxPoints || 10), 0);

    // Get all followers (users who have this as active challenge)
    const followers = await ActiveChallenge.find({ challengeId, source }).lean();
    const followerUserIds = followers.map(f => f.user.toString());

    // Get all users with progress for this challenge
    const progressDocs = await Progress.find({ challengeId }).lean();

    // Build a map of userId -> progress data
    const progressMap = {};
    for (const doc of progressDocs) {
      progressMap[doc.user.toString()] = doc.entries || {};
    }

    // Merge followers + progress users into a unique set
    const userIds = new Set([...followerUserIds, ...Object.keys(progressMap)]);

    const entries = [];
    for (const userId of userIds) {
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
            totalEarned += Number(dateMap[dateStr]) || 0;
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
