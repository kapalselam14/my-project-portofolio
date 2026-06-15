// Set env vars before any module loads so jwt.verify / jwt.sign pick them up at call time
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1d';
process.env.NODE_ENV = 'test';

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let replSet;

// Start a single-node replica set once; shared across all test files
// (fileParallelism: false ensures they all run in the same process)
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  }
}, 120000); // 2 min: first run downloads the MongoDB binary

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

// Wipe every collection between tests for a clean slate
afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})));
});
