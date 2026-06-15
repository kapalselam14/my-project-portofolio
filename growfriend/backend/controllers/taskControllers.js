const { listTasks, getTask, getApplications } = require('./tasks/taskQueryController');
const { createTask, updateTask, cancelTask, reopenTask, deleteTask } = require('./tasks/taskCrudController');
const { applyForTask, withdrawApplication, decideApplication, withdrawAssignment, abandonP2PTask } = require('./tasks/taskApplicationController');
const { submitTask, confirmTask, rejectTaskSubmission, disputeTask } = require('./tasks/taskProgressController');

module.exports = {
  listTasks,
  getTask,
  getApplications,
  createTask,
  updateTask,
  cancelTask,
  reopenTask,
  deleteTask,
  applyForTask,
  withdrawApplication,
  decideApplication,
  withdrawAssignment,
  abandonP2PTask,
  submitTask,
  confirmTask,
  rejectTaskSubmission,
  disputeTask
};
