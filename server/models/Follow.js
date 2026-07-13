const mongoose = require('mongoose');

// Separate from ActiveChallenge on purpose: "active" is what you're checking off habits
// for today, "follow" is which challenge's leaderboard you actually care about. Selecting
// a challenge in the Today-page dropdown auto-follows it too (see ChallengeSelector.jsx),
// but Discover's Follow button can independently follow a different challenge without
// touching what's active.
const followSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  challengeId: { type: String, required: true },
  source: { type: String, enum: ['default', 'user', 'group'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('Follow', followSchema);
