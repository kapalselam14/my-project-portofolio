const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const { isRedisReady } = require('./config/redis');
const { isCacheEnabled } = require('./utils/cache');
const { sendError } = require('./utils/apiResponse');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const storeRoutes = require('./routes/storeRoutes');
const petRoutes = require('./routes/petRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const taskRoutes = require('./routes/taskRoutes');
const focusRoutes = require('./routes/focusRoutes');
const adminRoutes = require('./routes/adminRoutes');
const coinRoutes = require('./routes/coinRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'GrowFriend API running' });
});

app.get('/api/health', (_req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const redisReady = isRedisReady();
  const cacheEnabled = isCacheEnabled();
  const statusCode = mongoReady ? 200 : 503;
  return res.status(statusCode).json({
    success: mongoReady,
    message: mongoReady ? 'Service healthy' : 'Service degraded',
    data: {
      mongo: { ready: mongoReady, state: mongoose.connection.readyState },
      redis: { ready: redisReady },
      cache: { enabled: cacheEnabled },
      uptimeSec: Math.floor(process.uptime())
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coins', coinRoutes);

app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return sendError(res, 'Internal server error', 500);
});

module.exports = app;
