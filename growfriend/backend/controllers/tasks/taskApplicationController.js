const {
  mongoose, Task, TaskApplication, TaskAssignment, TaskEscrow, CoinTransaction, User,
  invalidateCoinMutationCachesForUsers, formatTask, formatApplication, formatAssignment
} = require('./taskHelpers');

// POST /api/tasks/:id/apply
// SYSTEM (requiresApplication=false) → direct assignment
// SYSTEM (requiresApplication=true) / P2P → create application
const applyForTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    dbSession.startTransaction();

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }
    if (task.status !== 'OPEN') {
      throw { status: 400, code: 'TASK_NOT_OPEN', message: 'Task is no longer open for applications' };
    }
    if (task.endAt && new Date(task.endAt) < new Date()) {
      throw { status: 400, code: 'TASK_EXPIRED', message: 'This task has expired and can no longer be accepted' };
    }
    if (task.type === 'PERSONAL') {
      throw { status: 400, code: 'CANNOT_APPLY_PERSONAL', message: 'Cannot apply for a personal task' };
    }
    if (task.type === 'P2P' && String(task.createdBy) === String(userId)) {
      throw { status: 400, code: 'CANNOT_APPLY_OWN_TASK', message: 'Cannot apply for your own task' };
    }

    // SYSTEM (direct): stays OPEN so multiple players can accept simultaneously
    if (task.type === 'SYSTEM' && !task.requiresApplication) {
      const existingAssignment = await TaskAssignment.findOne({ taskId: id, assignedTo: userId }).session(dbSession);
      if (existingAssignment) {
        throw { status: 409, code: 'TASK_ALREADY_ASSIGNED', message: 'You have already accepted this task' };
      }

      const [assignment] = await TaskAssignment.create([{
        taskId: task._id,
        assignedTo: userId,
        assignedBy: null,
        status: 'ASSIGNED'
      }], { session: dbSession });

      // task.status intentionally NOT changed — SYSTEM tasks stay OPEN for other players

      await dbSession.commitTransaction();
      dbSession.endSession();
      if (task.rewardCoins > 0) {
        await invalidateCoinMutationCachesForUsers([userId]);
      }

      return res.status(200).json({
        success: true,
        message: 'Task taken successfully',
        data: { assignment: formatAssignment(assignment) }
      });
    }

    // P2P (direct, first-come-first-served): task moves to IN_PROGRESS, locked to one assignee
    if (task.type === 'P2P') {
      const existingAssignment = await TaskAssignment.findOne({ taskId: id, status: { $in: ['ASSIGNED', 'DONE_PENDING_CONFIRMATION'] } }).session(dbSession);
      if (existingAssignment) {
        throw { status: 409, code: 'TASK_ALREADY_ASSIGNED', message: 'This task has already been taken' };
      }

      const [assignment] = await TaskAssignment.create([{
        taskId: task._id,
        assignedTo: userId,
        assignedBy: null,
        status: 'ASSIGNED'
      }], { session: dbSession });

      task.status = 'IN_PROGRESS';
      await task.save({ session: dbSession });

      if (task.rewardCoins > 0) {
        await TaskEscrow.findOneAndUpdate(
          { taskId: task._id },
          { payeeUserId: userId },
          { session: dbSession }
        );
      }

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(200).json({
        success: true,
        message: 'Task taken successfully',
        data: { assignment: formatAssignment(assignment) }
      });
    }

    // SYSTEM with requiresApplication=true: create application (PENDING)
    const existingApp = await TaskApplication.findOne({ taskId: id, userId }).session(dbSession);
    if (existingApp) {
      throw { status: 409, code: 'APPLICATION_ALREADY_EXISTS', message: 'You have already applied for this task' };
    }

    const [application] = await TaskApplication.create([{
      taskId: task._id,
      userId,
      status: 'PENDING',
      appliedAt: new Date()
    }], { session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(201).json({
      success: true,
      message: 'Application submitted',
      data: { application: formatApplication(application) }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('applyForTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_APPLY_FAILED', message: error.message || 'Failed to apply for task', details: {} }
    });
  }
};

// DELETE /api/tasks/:id/apply
const withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    const application = await TaskApplication.findOne({ taskId: id, userId });
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'No application found for this task', details: {} }
      });
    }
    if (application.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: { code: 'APPLICATION_NOT_PENDING', message: 'Only pending applications can be withdrawn', details: {} }
      });
    }

    application.status = 'WITHDRAWN';
    application.decidedAt = new Date();
    await application.save();

    return res.status(200).json({
      success: true,
      message: 'Application withdrawn',
      data: { application: formatApplication(application) }
    });
  } catch (error) {
    console.error('withdrawApplication error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'WITHDRAW_FAILED', message: 'Failed to withdraw application', details: {} }
    });
  }
};

// PATCH /api/tasks/:id/applications/:appId/decide
// body: { action: 'ACCEPT' | 'REJECT' }
const decideApplication = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const { id, appId } = req.params;
    const userId = req.userId;
    const roles = req.auth?.roles || [];
    const { action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(appId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid task or application id', details: {} }
      });
    }
    if (!['ACCEPT', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'action must be ACCEPT or REJECT', details: {} }
      });
    }

    dbSession.startTransaction();

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }

    const isCreator = String(task.createdBy._id) === String(userId);
    const isAdmin = roles.includes('ADMIN');

    if (task.type === 'SYSTEM' && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only admins can decide on SYSTEM task applications' };
    }
    if (task.type === 'P2P' && !isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator can decide on P2P applications' };
    }

    const application = await TaskApplication.findById(appId).session(dbSession);
    if (!application || String(application.taskId) !== String(id)) {
      throw { status: 404, code: 'APPLICATION_NOT_FOUND', message: 'Application not found' };
    }
    if (application.status !== 'PENDING') {
      throw { status: 400, code: 'APPLICATION_NOT_PENDING', message: 'Application is not in PENDING state' };
    }

    application.decidedAt = new Date();

    if (action === 'REJECT') {
      application.status = 'REJECTED';
      await application.save({ session: dbSession });

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(200).json({
        success: true,
        message: 'Application rejected',
        data: { application: formatApplication(application) }
      });
    }

    // ACCEPT
    if (task.status !== 'OPEN') {
      throw { status: 400, code: 'TASK_NOT_OPEN', message: 'Task is no longer open' };
    }

    application.status = 'ACCEPTED';
    await application.save({ session: dbSession });

    const [assignment] = await TaskAssignment.create([{
      taskId: task._id,
      assignedTo: application.userId,
      assignedBy: userId,
      status: 'ASSIGNED'
    }], { session: dbSession });

    task.status = 'IN_PROGRESS';
    await task.save({ session: dbSession });

    if (task.type === 'P2P') {
      await TaskEscrow.findOneAndUpdate(
        { taskId: task._id },
        { payeeUserId: application.userId },
        { session: dbSession }
      );

      // Reject other pending applications for this task
      await TaskApplication.updateMany(
        { taskId: task._id, status: 'PENDING', _id: { $ne: appId } },
        { $set: { status: 'REJECTED', decidedAt: new Date() } },
        { session: dbSession }
      );
    }

    await dbSession.commitTransaction();
    dbSession.endSession();
    if (task.rewardCoins > 0) {
      await invalidateCoinMutationCachesForUsers([application.userId]);
    }

    return res.status(200).json({
      success: true,
      message: 'Application accepted, task assigned',
      data: {
        application: formatApplication(application),
        assignment: formatAssignment(assignment)
      }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('decideApplication error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'DECIDE_APPLICATION_FAILED', message: error.message || 'Failed to decide application', details: {} }
    });
  }
};

// DELETE /api/tasks/:id/assignment
// Player withdraws from a SYSTEM task they accepted.
// Task stays OPEN — no coin impact (SYSTEM tasks don't use escrow).
const withdrawAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

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
    if (task.type !== 'SYSTEM') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_TYPE', message: 'Only SYSTEM task assignments can be withdrawn this way', details: {} }
      });
    }

    const assignment = await TaskAssignment.findOne({ taskId: id, assignedTo: userId, status: 'ASSIGNED' });
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'No active assignment found for this task', details: {} }
      });
    }

    await assignment.deleteOne();

    return res.status(200).json({ success: true, message: 'Assignment withdrawn', data: {} });
  } catch (error) {
    console.error('withdrawAssignment error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'WITHDRAW_ASSIGNMENT_FAILED', message: 'Failed to withdraw assignment', details: {} }
    });
  }
};

// POST /api/tasks/:id/abandon
// P2P assignee withdraws from an active task. Task reverts to CANCELLED.
const abandonP2PTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    dbSession.startTransaction();

    const task = await Task.findById(id).session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }
    if (task.type !== 'P2P') {
      throw { status: 400, code: 'INVALID_TASK_TYPE', message: 'Only P2P tasks can be abandoned this way' };
    }
    if (!['IN_PROGRESS'].includes(task.status)) {
      throw { status: 400, code: 'TASK_NOT_ABANDONABLE', message: 'Only active P2P tasks can be abandoned' };
    }

    const assignment = await TaskAssignment.findOne({ taskId: id, assignedTo: userId, status: 'ASSIGNED' }).session(dbSession);
    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'No active assignment found for this task' };
    }

    assignment.status = 'CANCELLED';
    await assignment.save({ session: dbSession });

    task.status = 'CANCELLED';
    task.assignee = null;
    await task.save({ session: dbSession });

    const escrow = await TaskEscrow.findOne({ taskId: id, status: 'HELD' }).session(dbSession);
    if (escrow) {
      escrow.status = 'REFUNDED';
      escrow.refundedAt = new Date();
      await escrow.save({ session: dbSession });

      const creator = await User.findByIdAndUpdate(
        task.createdBy,
        { $inc: { coins: escrow.amount } },
        { new: true, session: dbSession }
      );

      await CoinTransaction.create([{
        userId: task.createdBy,
        amount: escrow.amount,
        balanceAfter: creator.coins,
        type: 'ESCROW_REFUND',
        relatedModel: 'Task',
        relatedId: task._id,
        note: `Escrow refunded: Assignee abandoned task ${task.title}`
      }], { session: dbSession });
    }

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: 'Task abandoned — marked as cancelled and creator refunded',
      data: { task: formatTask(task) }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('abandonP2PTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_ABANDON_FAILED', message: error.message || 'Failed to abandon task', details: {} }
    });
  }
};

module.exports = { applyForTask, withdrawApplication, decideApplication, withdrawAssignment, abandonP2PTask };
