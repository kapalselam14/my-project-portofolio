const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  applyForTask,
  withdrawApplication,
  withdrawAssignment,
  getApplications,
  decideApplication,
  submitTask,
  confirmTask,
  rejectTaskSubmission,
  cancelTask,
  reopenTask,
  abandonP2PTask,
  disputeTask
} = require('../controllers/taskControllers');

router.get('/', requireAuth, listTasks);
router.post('/', requireAuth, createTask);
router.get('/:id', requireAuth, getTask);
router.patch('/:id', requireAuth, updateTask);
router.delete('/:id', requireAuth, deleteTask);
router.post('/:id/apply', requireAuth, applyForTask);
router.delete('/:id/apply', requireAuth, withdrawApplication);
router.delete('/:id/assignment', requireAuth, withdrawAssignment);
router.get('/:id/applications', requireAuth, getApplications);
router.patch('/:id/applications/:appId/decide', requireAuth, decideApplication);
router.post('/:id/submit', requireAuth, submitTask);
router.post('/:id/confirm', requireAuth, confirmTask);
router.post('/:id/reject', requireAuth, rejectTaskSubmission);
router.post('/:id/cancel', requireAuth, cancelTask);
router.post('/:id/reopen', requireAuth, reopenTask);
router.post('/:id/abandon', requireAuth, abandonP2PTask);
router.post('/:id/dispute', requireAuth, disputeTask);

module.exports = router;
