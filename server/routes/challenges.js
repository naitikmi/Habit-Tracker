const express = require('express');
const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
const ActiveChallenge = require('../models/ActiveChallenge');
const Follow = require('../models/Follow');
const Progress = require('../models/Progress');
const Group = require('../models/Group');
const User = require('../models/User');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

function getChallengeEndDate(challenge) {
  const [y, m, d] = challenge.startDate.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() + challenge.days - 1);
  return end;
}

// Local YYYY-MM-DD, not toISOString() — that converts to UTC and can roll the date
// back a day for timezones ahead of UTC (e.g. IST).
function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Get default challenges (public)
router.get('/default', async (req, res) => {
  const challenges = await Challenge.find({ type: 'default' }).sort({ _id: 1 }).lean();
  res.json({ ok: true, data: { challenges } });
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

// Get user challenges
router.get('/user', authMiddleware, async (req, res) => {
  const challenges = await Challenge.find({ type: 'user', owner: new mongoose.Types.ObjectId(req.user.id) }).sort({ _id: 1 }).lean();
  res.json({ ok: true, data: { challenges } });
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

// Followed challenge per user — separate from "active" so Discover can independently follow
// a challenge without switching what's tracked today. The Today-page dropdown auto-follows
// whatever it selects (see ChallengeSelector.jsx), so this normally mirrors ActiveChallenge,
// but Discover's Follow button can override it to follow something else instead.
router.get('/follow', authMiddleware, async (req, res) => {
  const f = await Follow.findOne({ user: new mongoose.Types.ObjectId(req.user.id) });
  res.json({ ok: true, data: f ? { challengeId: f.challengeId, source: f.source } : null });
});

router.post('/follow', authMiddleware, async (req, res) => {
  try {
    const { challengeId, source } = req.body;
    await Follow.findOneAndUpdate(
      { user: new mongoose.Types.ObjectId(req.user.id) },
      { challengeId, source },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get all challenges for discovery (defaults + user challenges — admins see everyone's, regular users see only their own).
// Only shows challenges that are still active (haven't reached their last day yet) — ended ones
// belong in the "Ended Challenges" history view (see /history), not in Discover.
router.get('/community', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const userChallengeQuery = isAdmin ? { type: 'user' } : { type: 'user', owner: userId };
    const [allDefaults, allUserChallenges, followed] = await Promise.all([
      Challenge.find({ type: 'default' }).sort({ _id: 1 }).lean(),
      Challenge.find(userChallengeQuery).populate('owner', 'username profilePicture').sort({ _id: 1 }).lean(),
      Follow.findOne({ user: userId })
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isStillActive = (c) => today <= getChallengeEndDate(c);
    const defaults = allDefaults.filter(isStillActive);
    const userChallenges = allUserChallenges.filter(isStillActive);

    const following = followed ? { id: followed.challengeId, source: followed.source } : null;

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

// Get ALL challenges (defaults + user + group) with full details for dropdown.
// Admins see every user's personal challenges; regular users only see their own + defaults + their groups'.
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const userChallengeQuery = isAdmin ? { type: 'user' } : { type: 'user', owner: userId };

    const [defaults, userChallenges, userGroups] = await Promise.all([
      Challenge.find({ type: 'default' }).sort({ _id: 1 }).lean(),
      Challenge.find(userChallengeQuery).populate('owner', 'username').sort({ _id: 1 }).lean(),
      isAdmin ? Group.find({}).lean() : Group.find({ members: userId }).lean()
    ]);

    const all = [
      ...defaults.map(c => ({ ...c, _source: 'default' })),
      ...userChallenges.map(c => ({ ...c, _source: 'user', creatorName: c.owner?.username || 'Unknown' }))
    ];

    // Add group challenges
    for (const group of userGroups) {
      if (!group.challengeId) continue;
      const challenge = await Challenge.findOne({ id: group.challengeId }).lean();
      if (challenge) {
        all.push({ ...challenge, _source: 'group', creatorName: 'Group: ' + group.name });
      }
    }

    res.json({ ok: true, data: { challenges: all } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function computeProgressStats(challenge, entries) {
  const habitMaxMap = {};
  let habitMaxSum = 0;
  for (const h of challenge.habits) {
    habitMaxMap[h.id] = h.maxPoints || 10;
    habitMaxSum += h.maxPoints || 10;
  }
  let totalEarned = 0;
  const dateSet = new Set();
  for (const habitId of Object.keys(entries || {})) {
    const dateMap = entries[habitId] || {};
    for (const ds of Object.keys(dateMap)) {
      dateSet.add(ds);
      if (Number(dateMap[ds]) > 0) totalEarned += habitMaxMap[habitId] || 10;
    }
  }
  // Denominator is the full challenge duration (not just days tracked), so the
  // percentage reflects how much of the whole challenge was actually completed.
  const totalPossible = challenge.days * (habitMaxSum || 1);
  const percentage = totalPossible ? Math.round((totalEarned / totalPossible) * 100) : 0;
  return { daysTracked: dateSet.size, totalEarned, totalPossible, percentage };
}

// Ended challenges with performance stats.
// Regular users get their own completed (tracked) challenges only.
// Admins get every challenge that has ended, system-wide — including ones nobody
// ever logged progress on — so they can see the full inventory of what's finished.
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const isAdmin = req.user.role === 'admin';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const usernameCache = new Map();
    async function getUsername(uid) {
      const key = String(uid);
      if (usernameCache.has(key)) return usernameCache.get(key);
      const u = await User.findById(uid).lean();
      const name = u ? u.username : 'Unknown';
      usernameCache.set(key, name);
      return name;
    }

    async function getCreatorName(challenge) {
      if (challenge.type === 'default') return 'Admin';
      if (challenge.owner) return getUsername(challenge.owner);
      return 'Unknown';
    }

    const results = [];

    if (isAdmin) {
      const challenges = await Challenge.find({}).lean();
      for (const challenge of challenges) {
        const end = getChallengeEndDate(challenge);
        if (today <= end) continue; // still ongoing

        const base = {
          challengeId: challenge.id,
          name: challenge.name,
          source: challenge.type,
          days: challenge.days,
          startDate: challenge.startDate,
          endDate: dateStr(end),
          habitsCount: challenge.habits.length,
          creatorName: await getCreatorName(challenge)
        };

        const progressDocs = await Progress.find({ challengeId: challenge.id }).lean();
        if (!progressDocs.length) {
          results.push({
            ...base,
            daysTracked: 0, totalEarned: 0,
            totalPossible: computeProgressStats(challenge, {}).totalPossible,
            percentage: 0,
            username: null,
            tracked: false
          });
        } else {
          for (const doc of progressDocs) {
            results.push({
              ...base,
              ...computeProgressStats(challenge, doc.entries),
              username: await getUsername(doc.user),
              tracked: true
            });
          }
        }
      }
    } else {
      const progressDocs = await Progress.find({ user: userId }).lean();
      for (const doc of progressDocs) {
        const challenge = await Challenge.findOne({ id: doc.challengeId }).lean();
        if (!challenge) continue;
        const end = getChallengeEndDate(challenge);
        if (today <= end) continue; // still ongoing

        results.push({
          challengeId: challenge.id,
          name: challenge.name,
          source: challenge.type,
          days: challenge.days,
          startDate: challenge.startDate,
          endDate: dateStr(end),
          habitsCount: challenge.habits.length,
          creatorName: await getCreatorName(challenge),
          ...computeProgressStats(challenge, doc.entries),
          tracked: true
        });
      }
    }

    results.sort((a, b) => b.endDate.localeCompare(a.endDate));
    res.json({ ok: true, data: results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
