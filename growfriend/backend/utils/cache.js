const { getRedisClient, isRedisReady } = require('../config/redis');

const DEFAULT_TTL_SECONDS = 30;

function isCacheEnabled() {
  const raw = String(process.env.CACHE_ENABLED ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function buildUserCacheKey(userId, scope, suffix = '') {
  return `u:${String(userId)}:${scope}${suffix ? `:${suffix}` : ''}`;
}

async function getCachedJson(key) {
  if (!isCacheEnabled() || !isRedisReady()) return null;
  try {
    const client = getRedisClient();
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Cache get failed:', err?.message || err);
    return null;
  }
}

async function setCachedJson(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!isCacheEnabled() || !isRedisReady()) return false;
  try {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn('Cache set failed:', err?.message || err);
    return false;
  }
}

async function deleteCacheKeys(keys = []) {
  if (!isCacheEnabled() || !isRedisReady() || !Array.isArray(keys) || keys.length === 0) return 0;
  try {
    const client = getRedisClient();
    return await client.del(keys);
  } catch (err) {
    console.warn('Cache del failed:', err?.message || err);
    return 0;
  }
}

async function deleteCacheByPrefix(prefix) {
  if (!isCacheEnabled() || !isRedisReady() || !prefix) return 0;
  try {
    const client = getRedisClient();
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length === 0) return 0;
    return await client.del(keys);
  } catch (err) {
    console.warn('Cache prefix del failed:', err?.message || err);
    return 0;
  }
}

function buildCoinMutationCacheKeys(userId) {
  return [
    buildUserCacheKey(userId, 'dashboard', 'v1'),
    buildUserCacheKey(userId, 'coins-balance', 'v1')
  ];
}

async function invalidateCoinMutationCaches(userId) {
  if (!userId) return 0;
  return deleteCacheKeys(buildCoinMutationCacheKeys(userId));
}

async function invalidateCoinMutationCachesForUsers(userIds = []) {
  const unique = [...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean).map((id) => String(id)))];
  if (unique.length === 0) return 0;
  const keys = unique.flatMap((id) => buildCoinMutationCacheKeys(id));
  return deleteCacheKeys(keys);
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  isCacheEnabled,
  buildUserCacheKey,
  getCachedJson,
  setCachedJson,
  deleteCacheKeys,
  deleteCacheByPrefix,
  buildCoinMutationCacheKeys,
  invalidateCoinMutationCaches,
  invalidateCoinMutationCachesForUsers
};
