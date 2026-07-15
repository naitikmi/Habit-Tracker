const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const Challenge = require('../models/Challenge');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create a group (any authenticated user)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !name.trim()) return res.json({ ok: false, error: 'Group name required' });
    const group = await Group.create({
      name: name.trim(),
      createdBy: new mongoose.Types.ObjectId(req.user.id),
      members: [new mongoose.Types.ObjectId(req.user.id)]
    });
    if (memberIds && Array.isArray(memberIds)) {
      const validIds = memberIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      group.members.push(...validIds);
      await group.save();
    }
    await group.populate('members', 'username profilePicture');
    await group.populate('createdBy', 'username');
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List groups for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const groups = await Group.find({ members: userId })
      .populate('members', 'username profilePicture')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, data: groups });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get group details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'username profilePicture')
      .populate('createdBy', 'username')
      .lean();
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const isMember = group.members.some(m => m._id.toString() === req.user.id);
    const isAdmin = req.user.role === 'admin';
    if (!isMember && !isAdmin) return res.json({ ok: false, error: 'Not a member' });
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Add members (admin or creator)
router.post('/:id/members', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Only the group creator or admin can add members' });
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds)) return res.json({ ok: false, error: 'memberIds array required' });
    for (const id of memberIds) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        const oid = new mongoose.Types.ObjectId(id);
        if (!group.members.some(m => m.toString() === id)) {
          group.members.push(oid);
        }
      }
    }
    await group.save();
    await group.populate('members', 'username profilePicture');
    await group.populate('createdBy', 'username');
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Remove member (admin or creator)
router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Only the group creator or admin can remove members' });
    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    await group.save();
    await group.populate('members', 'username profilePicture');
    await group.populate('createdBy', 'username');
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Create or update group challenge (admin or creator)
router.post('/:id/challenge', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Only the group creator or admin can manage challenges' });

    const { name, days, startDate, habits } = req.body;
    if (!name || !days || !startDate || !habits || !habits.length)
      return res.json({ ok: false, error: 'Name, days, startDate, and habits required' });

    const nextHabitId = habits.length + 1;
    const crypto = require('crypto');
    // Reuse the existing challenge id on edit so group.challengeId stays valid;
    // only mint a new one when creating for the first time.
    const challengeId = group.challengeId || crypto.randomUUID();
    const finalHabits = habits.map((h, i) => ({
      id: i + 1,
      name: h.name,
      maxPoints: h.maxPoints || 10,
      color: h.color || '#ff8c42'
    }));

    const challengeData = {
      id: challengeId,
      type: 'group',
      owner: new mongoose.Types.ObjectId(req.user.id),
      name: name.trim(),
      days,
      startDate,
      habits: finalHabits,
      nextHabitId
    };

    if (group.challengeId) {
      await Challenge.updateOne({ id: group.challengeId }, challengeData);
    } else {
      await Challenge.create(challengeData);
      group.challengeId = challengeId;
      await group.save();
    }

    res.json({ ok: true, data: { ...challengeData, habitsCount: finalHabits.length } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get group challenge (members and admin only — matches GET /:id's visibility rule)
router.get('/:id/challenge', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).lean();
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    const isMember = group.members.some(m => m.toString() === req.user.id);
    if (!isMember && req.user.role !== 'admin') return res.json({ ok: false, error: 'Not a member' });
    if (!group.challengeId) return res.json({ ok: true, data: null });
    const challenge = await Challenge.findOne({ id: group.challengeId }).lean();
    res.json({ ok: true, data: challenge || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Send message
router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    const isMember = group.members.some(m => m.toString() === req.user.id);
    if (!isMember && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Not a member' });
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ ok: false, error: 'Message text required' });
    const msg = await GroupMessage.create({
      group: group._id,
      sender: new mongoose.Types.ObjectId(req.user.id),
      text: text.trim()
    });
    await msg.populate('sender', 'username profilePicture');
    res.json({ ok: true, data: msg });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get messages
router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    const isMember = group.members.some(m => m.toString() === req.user.id);
    if (!isMember && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Not a member' });
    const messages = await GroupMessage.find({ group: group._id })
      .populate('sender', 'username profilePicture')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ ok: true, data: messages });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Delete group (creator or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    if (group.createdBy.toString() !== req.user.id && req.user.role !== 'admin')
      return res.json({ ok: false, error: 'Only the group creator or admin can delete the group' });
    if (group.challengeId) await Challenge.deleteOne({ id: group.challengeId });
    await GroupMessage.deleteMany({ group: group._id });
    await Group.deleteOne({ _id: group._id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Discover — list all groups the user is NOT in
router.get('/discover/all', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const allGroups = await Group.find({})
      .populate('members', 'username profilePicture')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .lean();
    const available = allGroups.filter(g => !g.members.some(m => m._id.toString() === req.user.id));
    res.json({ ok: true, data: available });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Join a group (self-join, any authenticated user)
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    const userId = new mongoose.Types.ObjectId(req.user.id);
    if (group.members.some(m => m.toString() === req.user.id))
      return res.json({ ok: false, error: 'Already a member' });
    group.members.push(userId);
    await group.save();
    await group.populate('members', 'username profilePicture');
    await group.populate('createdBy', 'username');
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Leave a group (self-leave)
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.json({ ok: false, error: 'Group not found' });
    group.members = group.members.filter(m => m.toString() !== req.user.id);
    await group.save();
    await group.populate('members', 'username profilePicture');
    await group.populate('createdBy', 'username');
    res.json({ ok: true, data: group });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
