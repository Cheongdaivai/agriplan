const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/agriplan';

  try {
    const conn = await mongoose.connect(uri, {
      // Mongoose 8 no longer needs these flags, but explicit is fine
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host} — db: ${conn.connection.name}`);
  } catch (err) {
    console.error(`[DB] Connection error: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected. Reconnecting…');
  });

  mongoose.connection.on('reconnected', () => {
    console.info('[DB] MongoDB reconnected.');
  });
};

module.exports = connectDB;
