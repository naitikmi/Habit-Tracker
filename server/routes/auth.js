const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'habit-tracker-secret-key-change-in-production';

function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('one special character');
  return errors;
}

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3) {
      return res.json({ ok: false, error: 'Username (min 3 chars) and password required' });
    }
    const pwErrors = validatePassword(password);
    if (pwErrors.length) {
      return res.json({ ok: false, error: 'Password must have: ' + pwErrors.join(', ') });
    }
    const existing = await User.findOne({ username });
    if (existing) return res.json({ ok: false, error: 'Username already taken' });
    const user = await User.create({ username, password });
    const token = jwt.sign({ id: user._id, username, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { username, role: 'user' } });
  } catch (e) {
    if (e.code === 11000) return res.json({ ok: false, error: 'Username already taken' });
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.json({ ok: false, error: 'Invalid username or password' });
    const match = await user.comparePassword(password);
    if (!match) return res.json({ ok: false, error: 'Invalid username or password' });
    const token = jwt.sign({ id: user._id, username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { username, role: user.role } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: { username: req.user.username, role: req.user.role } });
});

module.exports = router;
