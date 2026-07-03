const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  type: { type: String, enum: ['default', 'user'], required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  days: { type: Number, required: true, min: 1 },
  startDate: { type: String, required: true },
  habits: [{
    id: Number,
    name: String,
    maxPoints: { type: Number, default: 10 },
    color: String
  }],
  nextHabitId: { type: Number, default: 1 }
}, { timestamps: true, id: false });

module.exports = mongoose.model('Challenge', challengeSchema);
