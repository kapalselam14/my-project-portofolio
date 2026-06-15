const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in environment variables');
    }

    // Safeguard: force a known DB name if URI path is missing or incorrect.
    // Override with MONGO_DB_NAME in .env if needed.
    const dbName = process.env.MONGO_DB_NAME || 'growfriend';

    await mongoose.connect(mongoUri, {
      dbName
    });

    console.log(`MongoDB Connected Successfully (db: ${mongoose.connection.name})`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;