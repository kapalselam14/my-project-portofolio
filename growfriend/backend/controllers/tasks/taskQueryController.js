const {
  mongoose, Task, TaskApplication, TaskAssignment,
  formatTask, formatApplication, formatAssignment
} = require('./taskHelpers');

// GET /api/tasks
// Query: type, status, mine=true
const listTasks = async (req, res) => {
  try {
    const userId = req.userId;
    const { type, status, mine } = req.query;

    let filter;

    if (mine === 'true') {
      const assignments = await TaskAssignment.find({ assignedTo: userId, status: { $in: ['ASSIGNED', 'DONE_PENDING_CONFIRMATION', 'DISPUTED', 'COMPLETED'] } }).lean();
      const assignedTaskIds = assignments.map((a) => a.taskId);

      filter = { $or: [{ createdBy: userId }, { _id: { $in: assignedTaskIds } }] };
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (req.query.category) filter.category = req.query.category;
    } else {
      filter = { visibility: 'PUBLIC' };
      if (type) filter.type = type;
      filter.status = status || 'OPEN';
      if (req.query.category) filter.category = req.query.category;
    }

    const tasks = await Task.find(filter).populate('createdBy', 'name email').sort({ createdAt: -1 }).limit(50).lean();
    const mineMode = mine === 'true';
    const taskIds = tasks.map((task) => task._id);

    const ACTIVE_ASSIGNMENT_STATUSES = ['ASSIGNED', 'DONE_PENDING_CONFIRMATION', 'DISPUTED'];
    const MY_ASSIGNMENT_STATUSES = [...ACTIVE_ASSIGNMENT_STATUSES, 'COMPLETED'];
    const [taskAssignments, myAssignments, acceptedCounts] = await Promise.all([
      mineMode
        ? TaskAssignment.find({ taskId: { $in: taskIds }, status: { $in: ACTIVE_ASSIGNMENT_STATUSES } }).populate('assignedTo', 'name email').lean()
        : [],
      TaskAssignment.find({ taskId: { $in: taskIds }, assignedTo: userId, status: { $in: MY_ASSIGNMENT_STATUSES } }).lean(),
      TaskAssignment.aggregate([
        { $match: { taskId: { $in: taskIds }, status: { $in: [...ACTIVE_ASSIGNMENT_STATUSES, 'COMPLETED'] } } },
        { $group: { _id: '$taskId', count: { $sum: 1 } } },
      ]),
    ]);

    const assignmentByTaskId = new Map(taskAssignments.map((a) => [String(a.taskId), a]));
    const myAssignmentByTaskId = new Map(myAssignments.map((a) => [String(a.taskId), a]));
    const acceptedCountByTaskId = new Map(acceptedCounts.map((a) => [String(a._id), a.count]));

    return res.status(200).json({
      success: true,
      message: 'Tasks loaded',
      data: {
        tasks: tasks.map((task) => {
          const formatted = formatTask(task);
          const assignment = assignmentByTaskId.get(String(task._id));
          const myAssignment = myAssignmentByTaskId.get(String(task._id));
          return {
            ...formatted,
            assignee: assignment?.assignedTo ? {
              id: String(assignment.assignedTo._id ?? assignment.assignedTo),
              name: assignment.assignedTo.name || '',
            } : null,
            isAcceptedByMe: !!myAssignment && !(task.type === 'SYSTEM' && myAssignment.status === 'COMPLETED'),
            isCompletedByMe: task.type === 'SYSTEM' && !!myAssignment && myAssignment.status === 'COMPLETED',
            rejectedAt: myAssignment?.rejectedAt ?? null,
            lastRejectedAt: assignment?.rejectedAt ?? null,
            acceptedCount: acceptedCountByTaskId.get(String(task._id)) ?? 0,
          };
        })
      }
    });
  } catch (error) {
    console.error('listTasks error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'TASK_LIST_FAILED', message: 'Failed to load tasks', details: {} }
    });
  }
};

// GET /api/tasks/:id
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const roles = req.auth?.roles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    const task = await Task.findById(id).lean();
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found', details: {} }
      });
    }

    if (task.visibility === 'PRIVATE' && String(task.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this task', details: {} }
      });
    }

    const assignments = await TaskAssignment.find({ taskId: id }).lean();

    const isCreatorOrAdmin = String(task.createdBy) === String(userId) || roles.includes('ADMIN');
    let applications = [];
    if (isCreatorOrAdmin) {
      applications = await TaskApplication.find({ taskId: id }).lean();
    }

    return res.status(200).json({
      success: true,
      message: 'Task loaded',
      data: {
        task: formatTask(task),
        assignments: assignments.map(formatAssignment),
        applications: applications.map(formatApplication)
      }
    });
  } catch (error) {
    console.error('getTask error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'TASK_FETCH_FAILED', message: 'Failed to load task', details: {} }
    });
  }
};

// GET /api/tasks/:id/applications
const getApplications = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const roles = req.auth?.roles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    const task = await Task.findById(id).populate('createdBy', 'name email').lean();
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found', details: {} }
      });
    }

    const isCreatorOrAdmin = String(task.createdBy._id) === String(userId) || roles.includes('ADMIN');
    if (!isCreatorOrAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the task creator or admin can view applications', details: {} }
      });
    }

    const applications = await TaskApplication.find({ taskId: id }).lean();

    return res.status(200).json({
      success: true,
      message: 'Applications loaded',
      data: { applications: applications.map(formatApplication) }
    });
  } catch (error) {
    console.error('getApplications error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'APPLICATIONS_FETCH_FAILED', message: 'Failed to load applications', details: {} }
    });
  }
};

module.exports = { listTasks, getTask, getApplications };
