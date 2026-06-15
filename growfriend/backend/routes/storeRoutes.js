const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

const {
  getStoreItems,
  purchaseStoreItem
} = require('../controllers/storeControllers');

router.get('/items', requireAuth, getStoreItems);
router.post('/purchase', requireAuth, purchaseStoreItem);

module.exports = router;