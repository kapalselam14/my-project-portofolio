const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { getInventory } = require('../controllers/inventoryControllers');

router.get('/', requireAuth, getInventory);

module.exports = router;