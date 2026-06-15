const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getCoinHistory, getCoinBalance } = require('../controllers/coinControllers');

router.get('/history', requireAuth, getCoinHistory);
router.get('/balance', requireAuth, getCoinBalance);

module.exports = router;
