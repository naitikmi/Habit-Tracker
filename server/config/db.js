const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/habit-tracker';
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (e) {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  }
}

module.exports = connectDB;
