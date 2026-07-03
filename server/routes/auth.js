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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password || username.length < 3) {
      return res.json({ ok: false, error: 'Username (min 3 chars), email, and password required' });
    }
    if (!validateEmail(email)) {
      return res.json({ ok: false, error: 'Invalid email format' });
    }
    const pwErrors = validatePassword(password);
    if (pwErrors.length) {
      return res.json({ ok: false, error: 'Password must have: ' + pwErrors.join(', ') });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.json({ ok: false, error: 'Username already taken' });
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.json({ ok: false, error: 'Email already in use' });
    const user = await User.create({ username, email, password });
    const token = jwt.sign({ id: user._id, username, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ ok: true, token, user: { username, email: user.email, role: 'user', profilePicture: '' } });
  } catch (e) {
    if (e.code === 11000) return res.json({ ok: false, error: 'Username or email already taken' });
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
    res.json({ ok: true, token, user: { username, email: user.email, role: user.role, profilePicture: user.profilePicture || '' } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.json({ ok: false, error: 'User not found' });
  res.json({ ok: true, user: { username: user.username, email: user.email, role: user.role, profilePicture: user.profilePicture || '' } });
});

// Update profile (username, email, profilePicture)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, email, profilePicture } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.json({ ok: false, error: 'User not found' });

    if (username !== undefined) {
      if (username.length < 3) return res.json({ ok: false, error: 'Username must be at least 3 characters' });
      if (username !== user.username) {
        const taken = await User.findOne({ username });
        if (taken) return res.json({ ok: false, error: 'Username already taken' });
        user.username = username;
      }
    }

    if (email !== undefined) {
      if (!validateEmail(email)) return res.json({ ok: false, error: 'Invalid email format' });
      if (email.toLowerCase() !== user.email) {
        const taken = await User.findOne({ email: email.toLowerCase() });
        if (taken) return res.json({ ok: false, error: 'Email already in use' });
        user.email = email.toLowerCase();
      }
    }

    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    await user.save();
    res.json({ ok: true, user: { username: user.username, email: user.email, role: user.role, profilePicture: user.profilePicture || '' } });
  } catch (e) {
    if (e.code === 11000) return res.json({ ok: false, error: 'Username or email already taken' });
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.json({ ok: false, error: 'User not found' });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.json({ ok: false, error: 'Current password is incorrect' });

    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length) {
      return res.json({ ok: false, error: 'Password must have: ' + pwErrors.join(', ') });
    }

    user.password = newPassword;
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
