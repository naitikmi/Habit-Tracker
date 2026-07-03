const mongoose = require('mongoose');

const dataStoreSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

module.exports = mongoose.model('DataStore', dataStoreSchema);
