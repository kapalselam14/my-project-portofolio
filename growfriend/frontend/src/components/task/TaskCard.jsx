import { useState } from 'react';
import '../../styles/components/TaskCard.css';
import TaskCardFront from './TaskCardFront';
import TaskCardBack from './TaskCardBack';
import CoinBadge from '../ui/CoinBadge';
import StatusBadge from '../ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import userIconSmall from '../../assets/user-icon-small.png';
import { getDisplayStatus } from '../../utils/taskUtils';

const CARD_COLORS = [
  'var(--color-card-1)',
  'var(--color-card-2)',
  'var(--color-card-3)',
  'var(--color-card-4)',
];

function TaskCard({
  task,
  index,
  isEditMode = false,
  isDeleteMode = false,
  onEdit,
  onDelete,
  onUpdate,
  showSourceBadge = false,
  hideAccept = false,
  onCancel,
  onCancelDone,
  isAccepted = false,
  isSubmitted = false,
  onAccept,
  isCreatorView = false,
  onDetails,
  initialExpanded = false,
  onDismissQuest,
}) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { currentUser } = useApp();
  const cardColor = CARD_COLORS[index % CARD_COLORS.length];

  const handleClose = () => {
    setIsExpanded(false);
    setIsFlipped(false);
  };

  const handleDeleteConfirmed = async () => {
    try {
      setDeleteError('');
      await onDelete?.(task.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleteError(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to delete task');
    }
  };

  const expiredDate = new Date(task.expiredAt).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
  });

  const showAssignee =
    isCreatorView &&
    task.type === 'p2p' &&
    task.assignee &&
    (task.status === 'active' || task.status === 'pending_confirmation' || task.status === 'pending_review' || task.status === 'disputed');

  return (
    <>
      <div
        className="task-card-small"
        style={{ backgroundColor: cardColor }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="task-card-header">
          <div className="task-card-badges">
            {showSourceBadge ? (
              <>
                <span className={`task-card-source-badge task-card-source-badge--${task.type}`}>
                  {task.type === 'p2p' ? 'P2P' : 'System'}
                </span>
                <StatusBadge status={
                  task.type === 'community' && task.status === 'completed' ? 'completed' :
                  isSubmitted && task.type !== 'community' ? 'pending_review' :
                  getDisplayStatus(task, isAccepted, isCreatorView)
                } />
              </>
            ) : (
              task.status !== 'cancelled' || task.type !== 'community' ? (
                <StatusBadge status={task.type === 'community' ? (task.status === 'expired' ? 'expired' : 'open') : getDisplayStatus(task, isAccepted, isCreatorView)} />
              ) : null
            )}
          </div>
        </div>

        <h3 className="task-card-title">{task.title}</h3>
        <p className="task-card-instructions">{task.instructions}</p>
        {showAssignee && (
          <p className="task-card-assignee">👤 {task.assignee.name}</p>
        )}
        <div className="task-card-meta-group">
          {task.type === 'p2p' && !isCreatorView && (
            <p className="task-card-posted-by">
              <img src={userIconSmall} alt="" className="task-card-user-icon" />
              {task.createdBy?.id === currentUser?.id ? 'Me' : (task.createdBy?.name ?? 'Unknown')}
            </p>
          )}
          <p className="task-card-expired">Exp: {expiredDate}</p>
        </div>

        <div className="task-card-footer">
          <CoinBadge amount={task.rewardCoins} />
          <button className="task-card-btn" onClick={() => onDetails ? onDetails(task.id) : setIsExpanded(true)}>
            Details
          </button>
        </div>

        {isEditMode && isHovered && (task.status === 'open' || task.status === 'cancelled' || task.status === 'expired') && (
          <div className="task-card-mode-overlay">
            <button
              className="task-card-overlay-btn task-card-overlay-btn--edit"
              onClick={() => onEdit(task)}
            >
              Edit
            </button>
          </div>
        )}

        {isDeleteMode && isHovered && !showDeleteConfirm && task.status !== 'active' && task.status !== 'pending_review' && task.status !== 'pending_confirmation' && task.status !== 'disputed' && (
          <div className="task-card-mode-overlay">
            <button
              className="task-card-overlay-btn task-card-overlay-btn--delete"
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑
            </button>
          </div>
        )}

        {isEditMode && isHovered && task.status === 'completed' && (
          <div className="task-card-mode-overlay task-card-mode-overlay--locked">
            <span className="task-card-locked-icon">🔒</span>
            <span className="task-card-locked-text">Task completed</span>
          </div>
        )}

        {(isEditMode || isDeleteMode) && isHovered && (task.status === 'active' || task.status === 'pending_review' || task.status === 'pending_confirmation' || task.status === 'disputed') && (
          <div className="task-card-mode-overlay task-card-mode-overlay--locked">
            <span className="task-card-locked-icon">🔒</span>
            <span className="task-card-locked-text">
              {task.status === 'active' && ((task.rejectedAt || task.lastRejectedAt) ? 'Task is rejected' : 'Task is active')}
              {task.status === 'pending_review' && 'Awaiting review'}
              {task.status === 'pending_confirmation' && 'Awaiting review'}
              {task.status === 'disputed' && 'Under dispute'}
            </span>
          </div>
        )}

      </div>

      {showDeleteConfirm && (
        <div className="task-card-delete-modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="task-card-delete-modal" onClick={(e) => e.stopPropagation()}>
            <p className="task-card-delete-modal-text">Delete this task?</p>
            {deleteError && <p className="task-card-delete-modal-text" style={{ color: 'var(--text-error)', marginTop: '-4px' }}>{deleteError}</p>}
            <div className="task-card-confirm-actions">
              <button
                className="task-card-confirm-btn task-card-confirm-btn--yes"
                onClick={handleDeleteConfirmed}
              >
                Yes
              </button>
              <button
                className="task-card-confirm-btn task-card-confirm-btn--no"
                onClick={() => setShowDeleteConfirm(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="task-card-overlay" onClick={handleClose}>
          <div className="task-card-expanded-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className={`task-card-inner ${isFlipped ? 'flipped' : ''}`}>
              <TaskCardFront
                task={task}
                cardColor={cardColor}
                onFlip={() => setIsFlipped(true)}
                onClose={handleClose}
                hideAccept={hideAccept}
                onCancel={onCancel}
                onCancelDone={onCancelDone}
                isAccepted={isAccepted}
                isSubmitted={isSubmitted}
                onAccept={onAccept}
                isCreatorView={isCreatorView}
                onUpdateTask={onUpdate}
                onEditTask={() => { handleClose(); onEdit && onEdit(task); }}
                onDeleteTask={async (id) => {
                  await onDelete?.(id);
                  handleClose();
                }}
                onDismissQuest={onDismissQuest}
              />
              <TaskCardBack
                task={task}
                cardColor={cardColor}
                onFlip={() => setIsFlipped(false)}
                onClose={handleClose}
                isQuest={hideAccept}
                isAccepted={isAccepted}
                isCreatorView={isCreatorView}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TaskCard;
