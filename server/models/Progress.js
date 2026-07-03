const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  entries: { type: Map, of: Number, default: {} }
}, { timestamps: true });

progressSchema.index({ user: 1, challengeId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
