const mongoose = require('mongoose');

const TaskAssignmentSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    creatorConfirmedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    disputedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ASSIGNED', 'CHECKED_IN', 'CHECKED_OUT', 'DONE_PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
      default: 'ASSIGNED'
    }
  },
  { timestamps: true }
);

// useful for “my assigned tasks” view
TaskAssignmentSchema.index({ taskId: 1, assignedTo: 1 });
TaskAssignmentSchema.index({ assignedTo: 1, createdAt: -1 });

module.exports = mongoose.model('TaskAssignment', TaskAssignmentSchema);