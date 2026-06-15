const {
  mongoose, Task, TaskAssignment, TaskEscrow, CoinTransaction, User,
  invalidateCoinMutationCachesForUsers, formatTask, formatAssignment
} = require('./taskHelpers');

// POST /api/tasks/:id/submit
// Assignee marks their work as done.
// PERSONAL: auto-completes. SYSTEM: auto-completes with coin payout. P2P: awaits creator confirmation.
const submitTask = async (req, res) => {
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
    if (!['IN_PROGRESS', 'OPEN'].includes(task.status)) {
      throw { status: 400, code: 'TASK_NOT_IN_PROGRESS', message: 'Task is not in progress' };
    }

    const assignment = await TaskAssignment.findOne({
      taskId: id,
      assignedTo: userId,
      status: 'ASSIGNED'
    }).session(dbSession);

    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'No active assignment found for this task' };
    }

    // PERSONAL: auto-complete, no coin reward
    if (task.type === 'PERSONAL') {
      assignment.status = 'COMPLETED';
      assignment.completedAt = new Date();
      assignment.creatorConfirmedAt = new Date();
      await assignment.save({ session: dbSession });

      task.status = 'COMPLETED';
      await task.save({ session: dbSession });

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(200).json({
        success: true,
        message: 'Personal task completed',
        data: { task: formatTask(task), assignment: formatAssignment(assignment) }
      });
    }

    // SYSTEM: auto-complete with coin payout. Task stays OPEN for other players.
    if (task.type === 'SYSTEM') {
      const now = new Date();
      assignment.status = 'COMPLETED';
      assignment.completedAt = now;
      assignment.creatorConfirmedAt = now;
      await assignment.save({ session: dbSession });

      // task.status intentionally NOT changed — stays OPEN for other players

      if (task.rewardCoins > 0) {
        const assignee = await User.findByIdAndUpdate(
          userId,
          { $inc: { coins: task.rewardCoins } },
          { new: true, session: dbSession }
        );

        await CoinTransaction.create([{
          userId,
          amount: task.rewardCoins,
          balanceAfter: assignee.coins,
          type: 'TASK_REWARD',
          relatedModel: 'Task',
          relatedId: task._id,
          note: `Reward for completing SYSTEM task: ${task.title}`
        }], { session: dbSession });
      }

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(200).json({
        success: true,
        message: 'System task completed, coins rewarded',
        data: {
          task: formatTask(task),
          assignment: formatAssignment(assignment),
          ...(task.rewardCoins > 0 && { coinsAwarded: task.rewardCoins })
        }
      });
    }

    // P2P: awaits creator confirmation
    assignment.status = 'DONE_PENDING_CONFIRMATION';
    await assignment.save({ session: dbSession });

    task.status = 'PENDING_CONFIRMATION';
    await task.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();
    if (task.type === 'P2P') {
      await invalidateCoinMutationCachesForUsers([task.createdBy?._id || task.createdBy]);
    }

    return res.status(200).json({
      success: true,
      message: 'Task submitted, awaiting confirmation',
      data: { task: formatTask(task), assignment: formatAssignment(assignment) }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('submitTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_SUBMIT_FAILED', message: error.message || 'Failed to submit task', details: {} }
    });
  }
};

// POST /api/tasks/:id/confirm
// SYSTEM: admin only. P2P: task creator only.
// Awards coins: SYSTEM → TASK_REWARD; P2P → ESCROW_PAYOUT
const confirmTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
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

    dbSession.startTransaction();

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }
    if (task.status !== 'PENDING_CONFIRMATION') {
      throw { status: 400, code: 'TASK_NOT_PENDING', message: 'Task is not pending confirmation' };
    }

    const isCreator = String(task.createdBy._id) === String(userId);
    const isAdmin = roles.includes('ADMIN');

    if (task.type === 'SYSTEM' && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only admins can confirm SYSTEM tasks' };
    }
    if (task.type === 'P2P' && !isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator can confirm P2P tasks' };
    }

    const assignment = await TaskAssignment.findOne({
      taskId: id,
      status: 'DONE_PENDING_CONFIRMATION'
    }).session(dbSession);

    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'No assignment pending confirmation' };
    }

    const now = new Date();
    assignment.status = 'COMPLETED';
    assignment.completedAt = now;
    assignment.creatorConfirmedAt = now;
    await assignment.save({ session: dbSession });

    task.status = 'COMPLETED';
    await task.save({ session: dbSession });

    const assigneeId = assignment.assignedTo;
    const rewardCoins = task.rewardCoins;

    if (rewardCoins > 0) {
      if (task.type === 'SYSTEM') {
        const assignee = await User.findByIdAndUpdate(
          assigneeId,
          { $inc: { coins: rewardCoins } },
          { new: true, session: dbSession }
        );

        await CoinTransaction.create([{
          userId: assigneeId,
          amount: rewardCoins,
          balanceAfter: assignee.coins,
          type: 'TASK_REWARD',
          relatedModel: 'Task',
          relatedId: task._id,
          note: `Reward for completing SYSTEM task: ${task.title}`
        }], { session: dbSession });
      } else if (task.type === 'P2P') {
        const escrow = await TaskEscrow.findOne({ taskId: id, status: 'HELD' }).session(dbSession);
        if (escrow) {
          escrow.status = 'PAID_OUT';
          escrow.releasedAt = now;
          escrow.paidOutAt = now;
          await escrow.save({ session: dbSession });

          const assignee = await User.findByIdAndUpdate(
            assigneeId,
            { $inc: { coins: escrow.amount } },
            { new: true, session: dbSession }
          );

          await CoinTransaction.create([{
            userId: assigneeId,
            amount: escrow.amount,
            balanceAfter: assignee.coins,
            type: 'ESCROW_PAYOUT',
            relatedModel: 'Task',
            relatedId: task._id,
            note: `Escrow payout for P2P task: ${task.title}`
          }], { session: dbSession });
        }
      }
    }

    await dbSession.commitTransaction();
    dbSession.endSession();
    if (task.type === 'P2P') {
      await invalidateCoinMutationCachesForUsers([task.createdBy?._id || task.createdBy]);
    }

    return res.status(200).json({
      success: true,
      message: 'Task confirmed and completed',
      data: {
        task: formatTask(task),
        assignment: formatAssignment(assignment),
        ...(rewardCoins > 0 && { coinsAwarded: rewardCoins }),
      }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('confirmTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_CONFIRM_FAILED', message: error.message || 'Failed to confirm task', details: {} }
    });
  }
};

// POST /api/tasks/:id/reject
// Creator or admin. Moves a submitted task back to IN_PROGRESS so the assignee can redo it.
const rejectTaskSubmission = async (req, res) => {
  const dbSession = await mongoose.startSession();
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

    dbSession.startTransaction();

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }
    if (task.status !== 'PENDING_CONFIRMATION') {
      throw { status: 400, code: 'TASK_NOT_PENDING', message: 'Task is not pending confirmation' };
    }

    const isCreator = String(task.createdBy._id) === String(userId);
    const isAdmin = roles.includes('ADMIN');

    if (task.type === 'SYSTEM' && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only admins can reject SYSTEM tasks' };
    }
    if (task.type === 'P2P' && !isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator can reject P2P tasks' };
    }

    const assignment = await TaskAssignment.findOne({
      taskId: id,
      status: 'DONE_PENDING_CONFIRMATION'
    }).session(dbSession);

    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'No assignment pending confirmation' };
    }

    assignment.status = 'ASSIGNED';
    assignment.completedAt = null;
    assignment.creatorConfirmedAt = null;
    assignment.rejectedAt = new Date();
    await assignment.save({ session: dbSession });

    task.status = 'IN_PROGRESS';
    await task.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: 'Task rejected and returned to in progress',
      data: { task: formatTask(task), assignment: formatAssignment(assignment) }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('rejectTaskSubmission error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_REJECT_FAILED', message: error.message || 'Failed to reject task submission', details: {} }
    });
  }
};

// POST /api/tasks/:id/dispute
// Creator or assignee raises a dispute on a P2P task in PENDING_CONFIRMATION or IN_PROGRESS.
const disputeTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { reason, details } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }
    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Dispute reason is required', details: {} }
      });
    }

    dbSession.startTransaction();

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      throw { status: 404, code: 'TASK_NOT_FOUND', message: 'Task not found' };
    }
    if (task.type !== 'P2P') {
      throw { status: 400, code: 'INVALID_TASK_TYPE', message: 'Only P2P tasks can be disputed' };
    }
    if (!['IN_PROGRESS', 'PENDING_CONFIRMATION'].includes(task.status)) {
      throw { status: 400, code: 'TASK_NOT_DISPUTABLE', message: 'Only active or pending confirmation P2P tasks can be disputed' };
    }

    const isCreator = String(task.createdBy._id) === String(userId);

    const assignment = await TaskAssignment.findOne({
      taskId: id,
      status: { $in: ['ASSIGNED', 'DONE_PENDING_CONFIRMATION'] }
    }).session(dbSession);

    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'No active assignment found for this task' };
    }

    const isAssignee = String(assignment.assignedTo) === String(userId);

    if (!isCreator && !isAssignee) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator or assignee can raise a dispute' };
    }

    task.status = 'DISPUTED';
    task.disputeRaisedBy = isCreator ? 'creator' : 'assignee';
    task.disputeReason = String(reason).trim();
    task.disputeDetails = details ? String(details).trim() : null;
    await task.save({ session: dbSession });

    assignment.status = 'DISPUTED';
    assignment.disputedAt = new Date();
    await assignment.save({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({
      success: true,
      message: 'Dispute raised successfully',
      data: { task: formatTask(task) }
    });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('disputeTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_DISPUTE_FAILED', message: error.message || 'Failed to raise dispute', details: {} }
    });
  }
};

module.exports = { submitTask, confirmTask, rejectTaskSubmission, disputeTask };
