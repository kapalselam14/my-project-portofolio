const {
  mongoose, Task, TaskApplication, TaskAssignment, TaskEscrow, CoinTransaction, User,
  invalidateCoinMutationCachesForUsers, formatTask
} = require('./taskHelpers');

// POST /api/tasks
const createTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const userId = req.userId;
    const roles = req.auth?.roles || [];
    const {
      type, title, description = '', objectives = [], timeLimit = null,
      rewardCoins = 0, requiresApplication = false, location, startAt, category
    } = req.body;

    if (!['SYSTEM', 'P2P', 'PERSONAL'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_TYPE', message: 'type must be SYSTEM, P2P, or PERSONAL', details: {} }
      });
    }
    if (type === 'SYSTEM' && !roles.includes('ADMIN')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can create SYSTEM tasks', details: {} }
      });
    }
    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'TITLE_REQUIRED', message: 'title is required', details: {} }
      });
    }

    const coins = Number(rewardCoins);
    if (!Number.isFinite(coins) || coins < 0 || !Number.isInteger(coins)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REWARD_COINS', message: 'rewardCoins must be a non-negative integer', details: {} }
      });
    }

    // PERSONAL tasks have no coin reward to prevent self-gaming
    const finalRewardCoins = type === 'PERSONAL' ? 0 : coins;

    dbSession.startTransaction();

    const user = await User.findById(userId).session(dbSession);
    if (!user) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }
    if (type === 'P2P' && finalRewardCoins > 0 && user.coins < finalRewardCoins) {
      throw { status: 400, code: 'INSUFFICIENT_COINS', message: 'Not enough coins to fund this task' };
    }

    const computedEndAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const [task] = await Task.create([{
      type,
      visibility: type === 'PERSONAL' ? 'PRIVATE' : 'PUBLIC',
      createdBy: userId,
      title: String(title).trim(),
      description: String(description).trim(),
      objectives: Array.isArray(objectives) ? objectives.filter(o => String(o).trim().length > 0).map(o => String(o).trim()) : [],
      timeLimit: timeLimit ? Number(timeLimit) : null,
      category: (type === 'SYSTEM' && (category === 'organization' || category === 'activity')) ? category : null,
      rewardCoins: finalRewardCoins,
      status: 'OPEN',
      requiresApplication: type === 'PERSONAL' ? false : Boolean(requiresApplication),
      location: location || null,
      startAt: startAt ? new Date(startAt) : null,
      endAt: computedEndAt
    }], { session: dbSession });

    if (type === 'P2P' && finalRewardCoins > 0) {
      user.coins -= finalRewardCoins;
      await user.save({ session: dbSession });

      await CoinTransaction.create([{
        userId,
        amount: -finalRewardCoins,
        balanceAfter: user.coins,
        type: 'ESCROW_HOLD',
        relatedModel: 'Task',
        relatedId: task._id,
        note: `Escrow held for P2P task: ${task.title}`
      }], { session: dbSession });

      await TaskEscrow.create([{
        taskId: task._id,
        payerUserId: userId,
        amount: finalRewardCoins,
        status: 'HELD',
        heldAt: new Date()
      }], { session: dbSession });
    }

    await dbSession.commitTransaction();
    dbSession.endSession();
    if (type === 'P2P' && finalRewardCoins > 0) {
      await invalidateCoinMutationCachesForUsers([userId]);
    }

    const responseData = { task: formatTask(task) };
    if (type === 'P2P' && finalRewardCoins > 0) {
      responseData.coins = user.coins;
    }

    return res.status(201).json({ success: true, message: 'Task created', data: responseData });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('createTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_CREATE_FAILED', message: error.message || 'Failed to create task', details: {} }
    });
  }
};

// PATCH /api/tasks/:id
// Auth: creator or admin. SYSTEM tasks: admin only.
// Only editable when OPEN (P2P/SYSTEM) or IN_PROGRESS (PERSONAL).
// endAt is fixed at creation (createdAt + 5 days) and cannot be changed.
const updateTask = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    dbSession.startTransaction();

    const { id } = req.params;
    const userId = req.userId;
    const roles = req.auth?.roles || [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TASK_ID', message: 'Task id is not a valid ObjectId', details: {} }
      });
    }

    const task = await Task.findById(id).populate('createdBy', 'name email').session(dbSession);
    if (!task) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found', details: {} }
      });
    }

    const isCreator = String(task.createdBy._id) === String(userId);
    const isAdmin = roles.includes('ADMIN');

    if (!isCreator && !isAdmin) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the task creator or admin can edit this task', details: {} }
      });
    }
    if (task.type === 'SYSTEM' && !isAdmin) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only admins can edit SYSTEM tasks', details: {} }
      });
    }

    const editableStatuses = task.type === 'PERSONAL' ? ['IN_PROGRESS'] : ['OPEN', 'CANCELLED'];
    if (!editableStatuses.includes(task.status)) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return res.status(400).json({
        success: false,
        error: { code: 'TASK_NOT_EDITABLE', message: `Task can only be edited when ${editableStatuses.join(' or ')}`, details: {} }
      });
    }

    const { title, description, objectives, timeLimit, rewardCoins, category } = req.body;

    if (title !== undefined) task.title = String(title).trim();
    if (description !== undefined) task.description = String(description).trim();
    if (objectives !== undefined) {
      task.objectives = Array.isArray(objectives) ? objectives.filter(o => String(o).trim().length > 0).map(o => String(o).trim()) : [];
    }
    if (timeLimit !== undefined) task.timeLimit = timeLimit ? Number(timeLimit) : null;
    if (category !== undefined) {
      if (task.type === 'SYSTEM') {
        if (category === 'organization' || category === 'activity') task.category = category;
        else {
          await dbSession.abortTransaction();
          dbSession.endSession();
          return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'category must be organization or activity for SYSTEM tasks', details: {} } });
        }
      } else {
        task.category = null;
      }
    }

    if (rewardCoins !== undefined) {
      const coins = Number(rewardCoins);
      if (!Number.isFinite(coins) || coins < 0 || !Number.isInteger(coins)) {
        await dbSession.abortTransaction();
        dbSession.endSession();
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REWARD_COINS', message: 'rewardCoins must be a non-negative integer', details: {} }
        });
      }

      // Only adjust escrow when task is OPEN — when CANCELLED the escrow is already
      // REFUNDED, so coin locking happens later when the task is reopened.
      if (task.type === 'P2P' && task.status === 'OPEN') {
        const escrow = await TaskEscrow.findOne({ taskId: id, status: 'HELD' }).session(dbSession);
        const oldAmount = escrow ? escrow.amount : 0;
        const diff = coins - oldAmount;

        if (diff !== 0) {
          const creator = await User.findById(userId).session(dbSession);

          if (diff > 0 && creator.coins < diff) {
            await dbSession.abortTransaction();
            dbSession.endSession();
            return res.status(400).json({
              success: false,
              error: { code: 'INSUFFICIENT_COINS', message: 'Not enough coins to increase the reward', details: {} }
            });
          }

          creator.coins -= diff;
          await creator.save({ session: dbSession });

          await CoinTransaction.create([{
            userId,
            amount: -diff,
            balanceAfter: creator.coins,
            type: diff > 0 ? 'ESCROW_HOLD' : 'ESCROW_REFUND',
            relatedModel: 'Task',
            relatedId: task._id,
            note: `Escrow adjusted for P2P task edit: ${task.title}`
          }], { session: dbSession });

          if (escrow) {
            escrow.amount = coins;
            await escrow.save({ session: dbSession });
          } else if (coins > 0) {
            await TaskEscrow.create([{
              taskId: task._id,
              payerUserId: userId,
              amount: coins,
              status: 'HELD',
              heldAt: new Date()
            }], { session: dbSession });
          }
        }
      }

      task.rewardCoins = task.type === 'PERSONAL' ? 0 : coins;
    }

    await task.save({ session: dbSession });
    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({ success: true, message: 'Task updated', data: { task: formatTask(task) } });
  } catch (error) {
    try { await dbSession.abortTransaction(); } catch (_) {}
    dbSession.endSession();
    console.error('updateTask error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'TASK_UPDATE_FAILED', message: 'Failed to update task', details: {} }
    });
  }
};

// POST /api/tasks/:id/cancel
// Creator or admin. Refunds P2P escrow if still HELD.
const cancelTask = async (req, res) => {
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
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw { status: 400, code: 'TASK_ALREADY_FINAL', message: 'Task is already completed or cancelled' };
    }

    const isCreator = String(task.createdBy) === String(userId);
    const isAdmin = roles.includes('ADMIN');
    if (!isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator or admin can cancel this task' };
    }

    task.status = 'CANCELLED';
    await task.save({ session: dbSession });

    await TaskAssignment.updateMany(
      { taskId: id, status: { $in: ['ASSIGNED', 'CHECKED_IN', 'CHECKED_OUT', 'DONE_PENDING_CONFIRMATION'] } },
      { $set: { status: 'CANCELLED' } },
      { session: dbSession }
    );

    if (task.type === 'P2P') {
      const escrow = await TaskEscrow.findOne({ taskId: id, status: 'HELD' }).session(dbSession);
      if (escrow) {
        escrow.status = 'REFUNDED';
        escrow.refundedAt = new Date();
        await escrow.save({ session: dbSession });

        const payer = await User.findByIdAndUpdate(
          escrow.payerUserId,
          { $inc: { coins: escrow.amount } },
          { new: true, session: dbSession }
        );

        await CoinTransaction.create([{
          userId: escrow.payerUserId,
          amount: escrow.amount,
          balanceAfter: payer.coins,
          type: 'ESCROW_REFUND',
          relatedModel: 'Task',
          relatedId: task._id,
          note: `Escrow refunded for cancelled P2P task: ${task.title}`
        }], { session: dbSession });
      }
    }

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({ success: true, message: 'Task cancelled', data: { task: formatTask(task) } });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('cancelTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_CANCEL_FAILED', message: error.message || 'Failed to cancel task', details: {} }
    });
  }
};

// POST /api/tasks/:id/reopen
// Creator re-opens a CANCELLED or EXPIRED task back to OPEN.
const reopenTask = async (req, res) => {
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
    const isExpired = task.endAt && new Date(task.endAt) < new Date();
    if (!['CANCELLED'].includes(task.status) && !(task.status === 'OPEN' && isExpired)) {
      throw { status: 400, code: 'TASK_NOT_REOPENABLE', message: 'Only cancelled or expired tasks can be re-opened' };
    }

    const creatorId = String(task.createdBy._id ?? task.createdBy);
    const isCreator = creatorId === String(userId);
    const isAdmin = roles.includes('ADMIN');
    if (!isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator or admin can re-open this task' };
    }

    task.status = 'OPEN';
    task.endAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await task.save({ session: dbSession });

    await TaskAssignment.updateMany(
      { taskId: id, status: { $in: ['ASSIGNED', 'CANCELLED'] } },
      { $set: { status: 'CANCELLED' } },
      { session: dbSession }
    );

    // Re-lock escrow using the current rewardCoins (may have been edited while CANCELLED).
    if (task.type === 'P2P' && task.rewardCoins > 0) {
      const creator = await User.findById(creatorId).session(dbSession);
      if (creator.coins < task.rewardCoins) {
        throw { status: 400, code: 'INSUFFICIENT_COINS', message: 'Not enough coins to re-open this task' };
      }
      creator.coins -= task.rewardCoins;
      await creator.save({ session: dbSession });

      await CoinTransaction.create([{
        userId: creatorId,
        amount: -task.rewardCoins,
        balanceAfter: creator.coins,
        type: 'ESCROW_HOLD',
        relatedModel: 'Task',
        relatedId: task._id,
        note: `Escrow held for re-opened P2P task: ${task.title}`
      }], { session: dbSession });

      // Update existing escrow record instead of creating a new one (taskId has unique index)
      await TaskEscrow.findOneAndUpdate(
        { taskId: task._id },
        { payerUserId: creatorId, amount: task.rewardCoins, status: 'HELD', heldAt: new Date(), releasedAt: null, paidOutAt: null, refundedAt: null },
        { upsert: true, session: dbSession }
      );
    }

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({ success: true, message: 'Task re-opened', data: { task: formatTask(task) } });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('reopenTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_REOPEN_FAILED', message: error.message || 'Failed to re-open task', details: {} }
    });
  }
};

// DELETE /api/tasks/:id
// Auth: admin for SYSTEM; creator or admin for P2P/PERSONAL.
// Only deletable when status is OPEN, CANCELLED, or COMPLETED.
// P2P: auto-refunds escrow if still HELD.
const deleteTask = async (req, res) => {
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

    const isCreator = String(task.createdBy._id) === String(userId);
    const isAdmin = roles.includes('ADMIN');

    if (task.type === 'SYSTEM' && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only admins can delete SYSTEM tasks' };
    }
    if (task.type !== 'SYSTEM' && !isCreator && !isAdmin) {
      throw { status: 403, code: 'FORBIDDEN', message: 'Only the task creator can delete this task' };
    }
    if (!['OPEN', 'CANCELLED', 'COMPLETED'].includes(task.status)) {
      throw { status: 400, code: 'TASK_NOT_DELETABLE', message: 'Only open, cancelled, or completed tasks can be deleted' };
    }

    if (task.type === 'P2P') {
      const escrow = await TaskEscrow.findOne({ taskId: id, status: 'HELD' }).session(dbSession);
      if (escrow) {
        escrow.status = 'REFUNDED';
        escrow.refundedAt = new Date();
        await escrow.save({ session: dbSession });

        const payer = await User.findByIdAndUpdate(
          escrow.payerUserId,
          { $inc: { coins: escrow.amount } },
          { new: true, session: dbSession }
        );

        await CoinTransaction.create([{
          userId: escrow.payerUserId,
          amount: escrow.amount,
          balanceAfter: payer.coins,
          type: 'ESCROW_REFUND',
          relatedModel: 'Task',
          relatedId: task._id,
          note: `Escrow refunded for deleted P2P task: ${task.title}`
        }], { session: dbSession });
      }
    }

    await TaskApplication.deleteMany({ taskId: id }, { session: dbSession });
    await TaskAssignment.deleteMany({ taskId: id }, { session: dbSession });
    await TaskEscrow.deleteMany({ taskId: id }, { session: dbSession });
    await task.deleteOne({ session: dbSession });

    await dbSession.commitTransaction();
    dbSession.endSession();

    return res.status(200).json({ success: true, message: 'Task deleted', data: {} });
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    console.error('deleteTask error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'TASK_DELETE_FAILED', message: error.message || 'Failed to delete task', details: {} }
    });
  }
};

module.exports = { createTask, updateTask, cancelTask, reopenTask, deleteTask };
