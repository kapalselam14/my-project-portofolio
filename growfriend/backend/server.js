require('dotenv').config();

const connectDB = require('./config/db');
const { connectRedis, closeRedis } = require('./config/redis');
const { isCacheEnabled } = require('./utils/cache');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Graceful shutdown helper to close Redis cleanly
async function shutdown(signal) {
  try {
    console.log(`${signal} received. Shutting down...`);
    await closeRedis();
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err.message);
    process.exit(1);
  }
}

// Handle common termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

(async () => {
  try {
    await connectDB();

    // Redis is optional: do not hard-fail app startup if Redis is unavailable
    if (isCacheEnabled()) {
      try {
        await connectRedis();
      } catch (redisErr) {
        console.warn('Redis startup skipped:', redisErr.message);
      }
    } else {
      console.log('CACHE_ENABLED is false. Redis connection skipped.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server boot failed:', err.message);
    process.exit(1);
  }
})();
