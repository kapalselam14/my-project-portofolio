const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  startFocusSession,
  completeFocusSession,
  cancelFocusSession,
  getActiveFocusSession
} = require('../controllers/focusControllers');

const router = express.Router();

router.post('/start', requireAuth, startFocusSession);
router.post('/:id/complete', requireAuth, completeFocusSession);
router.post('/:id/cancel', requireAuth, cancelFocusSession);
router.get('/active', requireAuth, getActiveFocusSession);

module.exports = router;