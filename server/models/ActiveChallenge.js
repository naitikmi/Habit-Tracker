const mongoose = require('mongoose');

const activeChallengeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  challengeId: { type: String, required: true },
  source: { type: String, enum: ['default', 'user'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('ActiveChallenge', activeChallengeSchema);
