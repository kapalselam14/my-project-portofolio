const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const { listUsers, updateUserRoles, adjustCoins } = require('../controllers/adminControllers');

router.get('/users', requireAuth, requireAdmin, listUsers);
router.patch('/users/:id/roles', requireAuth, requireAdmin, updateUserRoles);
router.post('/coins/adjust', requireAuth, requireAdmin, adjustCoins);

module.exports = router;
