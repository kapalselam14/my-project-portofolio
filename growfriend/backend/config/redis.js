const { createClient } = require('redis');

let redisClient = null;
let connectPromise = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        // Prevent endless retry spam when Redis is unavailable/misconfigured
        reconnectStrategy: false,
        connectTimeout: 5000
      }
    });

    redisClient.on('error', (err) => {
      // Show useful error text even when err.message is empty
      console.error('Redis error:', err?.message || err);
    });
  }
  return redisClient;
}

async function connectRedis() {
  // Redis optional for now
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL not set. Redis connection skipped.');
    return null;
  }

  const client = getRedisClient();

  if (client.isOpen) return client;
  if (connectPromise) return connectPromise;

  connectPromise = client
    .connect()
    .then(() => {
      console.log('Redis connected');
      return client;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

function isRedisReady() {
  return Boolean(redisClient && redisClient.isOpen);
}

async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('Redis disconnected');
  }
}

module.exports = {
  getRedisClient,
  connectRedis,
  isRedisReady,
  closeRedis
};