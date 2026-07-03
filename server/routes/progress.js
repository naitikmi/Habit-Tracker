const express = require('express');
const DataStore = require('../models/DataStore');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const doc = await DataStore.findOne({ key: 'progress_' + req.user.id });
  res.json({ ok: true, data: doc ? doc.value : {} });
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    await DataStore.findOneAndUpdate(
      { key: 'progress_' + req.user.id },
      { value: req.body.data },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
