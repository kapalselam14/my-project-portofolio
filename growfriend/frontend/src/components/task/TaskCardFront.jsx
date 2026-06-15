import { useState, useEffect } from 'react'
import CoinBadge from '../ui/CoinBadge'
import StatusBadge from '../ui/StatusBadge'
import { useApp } from '../../context/AppContext'
import { getDisplayStatus } from '../../utils/taskUtils'
import DisputeForm from './DisputeForm'
import * as taskService from '../../services/taskService'

function TaskCardFront({
  task,
  cardColor,
  onFlip,
  onClose,
  hideAccept = false,
  onCancel,
  onCancelDone,
  isAccepted = false,
  isSubmitted = false,
  onAccept,
  isCreatorView = false,
  onUpdateTask,
  onEditTask,
  onDeleteTask,
  onDismissQuest,
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false)
  const [showAcceptSuccess, setShowAcceptSuccess] = useState(false)
  const [showReassignConfirm, setShowReassignConfirm] = useState(false)
  const [showConfirmReview, setShowConfirmReview] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)
  const [showP2PSubmitSuccess, setShowP2PSubmitSuccess] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showCancelSuccess, setShowCancelSuccess] = useState(false)
  const [showRejectSuccess, setShowRejectSuccess] = useState(false)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputePov, setDisputePov] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const { currentUser } = useApp()

  useEffect(() => {
    if (!toastMsg) return
    const timer = setTimeout(() => setToastMsg(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMsg])

  const isOwnTask = task.type === 'p2p' && task.createdBy?.id === currentUser?.id

  const expiredDate = new Date(task.expiredAt).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
  })

  const handleConfirmCancel = async () => {
    try {
      if (onCancel) {
        await onCancel(task.id)
      } else {
        await onUpdateTask?.(task.id, { status: 'cancelled' })
      }
      setShowCancelConfirm(false)
      setShowCancelSuccess(true)
      setTimeout(() => {
        onCancelDone?.(task.id)
        onClose()
      }, 1500)
    } catch (error) {
      setToastMsg(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to cancel task')
    }
  }

  const handleDeleteConfirmed = async () => {
    try {
      await onDeleteTask(task.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      setToastMsg(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to delete task')
    }
  }

  const handleReassign = async () => {
    try {
      await onUpdateTask(task.id, { status: 'open', assignee: null })
    } catch (err) {
      setToastMsg(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to re-open task')
    }
  }

  const openDisputeForm = (pov) => {
    setDisputePov(pov)
    setShowDisputeForm(true)
  }

  const handleDisputeSubmit = async ({ reason, details }) => {
    if (!reason || !disputePov) return
    try {
      await taskService.disputeTask(task.id, { reason, details: details || '' })
      onUpdateTask(task.id, {
        status: 'disputed',
        disputeRaisedBy: disputePov,
        disputeReason: reason,
        disputeDetails: details || '',
      })
      setShowDisputeForm(false)
      setToastMsg('Dispute raised. Awaiting admin review.')
    } catch (error) {
      setToastMsg(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to raise dispute')
    }
  }

  const handleCreatorConfirm = async () => {
    try {
      await onUpdateTask(task.id, { status: 'completed' })
      setShowConfirmReview(false)
    } catch (error) {
      setToastMsg(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to confirm task')
    }
  }

  const handleCreatorReject = async () => {
    try {
      await onUpdateTask(task.id, { status: 'active', rejectedAt: new Date().toISOString() })
      setShowRejectConfirm(false)
      setShowRejectSuccess(true)
      setTimeout(() => setShowRejectSuccess(false), 2000)
    } catch (error) {
      setToastMsg(error?.response?.data?.error?.message ?? error?.message ?? 'Failed to reject task')
    }
  }

  const isAcceptable = task.type === 'p2p' || task.type === 'community'

  const renderCreatorButtons = () => {
    switch (task.status) {
      case 'open':
        return (
          <>
            <button
              className="task-card-btn task-card-btn--flip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={onEditTask}
            >
              Edit
            </button>
            <button
              className="task-card-btn task-card-btn--delete"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </button>
          </>
        )
      case 'active':
        return (
          <p className="task-card-waiting-text">
            Waiting for assignee to submit...
          </p>
        )
      case 'pending_review':
      case 'pending_confirmation':
        return (
          <>
            <button
              className="task-card-btn task-card-btn--confirm"
              onClick={() => setShowConfirmReview(true)}
            >
              Confirm
            </button>
            <button
              className="task-card-btn task-card-btn--delete"
              onClick={() => setShowRejectConfirm(true)}
            >
              Reject
            </button>
            <button
              className="task-card-btn task-card-btn--dispute"
              onClick={() => openDisputeForm('creator')}
            >
              Dispute
            </button>
          </>
        )
      case 'disputed':
        return null
      case 'completed':
        return (
          <button
            className="task-card-btn task-card-btn--delete"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </button>
        )
      case 'cancelled':
      case 'expired':
        return (
          <>
            <button
              className="task-card-btn task-card-btn--flip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={onEditTask}
            >
              Edit
            </button>
            <button
              className="task-card-btn task-card-btn--reassign"
              onClick={() => setShowReassignConfirm(true)}
            >
              Re-assign
            </button>
            <button
              className="task-card-btn task-card-btn--delete"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </button>
          </>
        )
      default:
        return null
    }
  }

  const isAssigneeActive = hideAccept && isAcceptable && !isSubmitted && task.status !== 'disputed' &&
    (task.status === 'active' || (isAccepted && task.status === 'open') || (isAccepted && task.status === 'expired' && task.type === 'community'))

  return (
    <div className="task-card-face task-card-front" style={{ backgroundColor: cardColor }}>
      <div className="task-card-header">
        {!hideAccept && (task.status !== 'cancelled' || task.type !== 'community') && (
          <StatusBadge status={task.type === 'community' ? (task.status === 'expired' ? 'expired' : 'open') : getDisplayStatus(task, isAccepted, isCreatorView)} />
        )}
        {hideAccept && (
          <StatusBadge
            status={
              task.type === 'community' && task.status === 'completed' ? 'completed' :
              isSubmitted && task.type !== 'community' ? 'pending_review' :
              getDisplayStatus(task, isAccepted, isCreatorView)
            }
          />
        )}
        <button className="task-card-close" onClick={onClose}>✕</button>
      </div>

      <h3 className="task-card-title">{task.title}</h3>
      <p className="task-card-instructions">{task.instructions}</p>

      {task.type === 'p2p' && !isCreatorView && !hideAccept && (
        <p className="task-card-posted-by">
          👤 Posted by: {task.createdBy?.id === currentUser?.id ? 'Me' : (task.createdBy?.name ?? 'Unknown')}
        </p>
      )}

      {isCreatorView && task.type === 'p2p' && task.assignee && (
        <p className="task-card-posted-by">👤 Assigned to: {task.assignee.name || 'Unknown'}</p>
      )}

      <p className="task-card-expired">Expired: {expiredDate}</p>

      <div className="task-card-footer">
        <CoinBadge amount={task.rewardCoins} />
        <div className="task-card-actions">
          {isCreatorView ? (
            renderCreatorButtons()
          ) : (
            <>
              {!hideAccept && isAcceptable && (() => {
                const alreadyCompleted = task.isCompletedByMe && task.type === 'community';
                const disabledMsg =
                  isOwnTask ? "You can't accept your own task" :
                  alreadyCompleted ? "You've already completed this task" :
                  isAccepted ? "You've already accepted this task" :
                  task.status !== 'open' ? 'This task has already been taken' :
                  null;
                const isDisabled = isAccepted || alreadyCompleted || task.status !== 'open' || isOwnTask;
                return (
                  <div className={disabledMsg ? 'task-card-btn-tooltip-wrapper' : undefined} data-tooltip={disabledMsg ?? undefined}>
                    <button
                      className={`task-card-btn ${isAccepted ? 'task-card-btn--accepted' : 'task-card-btn--accept'}`}
                      disabled={isDisabled}
                      style={isDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      onClick={() => !isDisabled && setShowAcceptConfirm(true)}
                    >
                      {isAccepted ? 'Accepted!' : alreadyCompleted ? 'Completed' : 'Accept'}
                    </button>
                  </div>
                );
              })()}
              {isAssigneeActive && (
                <button
                  className="task-card-btn task-card-btn--cancel"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel
                </button>
              )}
              {isAssigneeActive && (
                <button
                  className="task-card-btn task-card-btn--confirm"
                  onClick={() => setShowSubmitConfirm(true)}
                >
                  Submit
                </button>
              )}
              {isAssigneeActive && task.type === 'p2p' && task.rejectedAt && (
                <button
                  className="task-card-btn task-card-btn--dispute"
                  onClick={() => openDisputeForm('assignee')}
                >
                  Raise Dispute
                </button>
              )}
              {hideAccept && (task.status === 'pending_review' || task.status === 'pending_confirmation' || (isSubmitted && task.type !== 'community')) && (
                <p className="task-card-waiting-text">
                  Waiting for creator confirmation...
                </p>
              )}
              {hideAccept && task.status === 'completed' && (
                <>
                  <p className="task-card-waiting-text">
                    Task completed! Coins rewarded.
                  </p>
                  {onDismissQuest && (
                    <button
                      className="task-card-btn task-card-btn--delete"
                      onClick={() => {
                        onDismissQuest(task.id)
                        onClose()
                      }}
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
              {hideAccept && task.status === 'disputed' && (
                <p className="task-card-waiting-text">
                  Task is under review. Awaiting admin decision.
                </p>
              )}
              {hideAccept && task.status === 'cancelled' && task.type === 'p2p' && task.disputeRaisedBy && (
                <>
                  <p className="task-card-waiting-text">
                    Dispute resolved. Creator was favored.
                  </p>
                  {onDismissQuest && (
                    <button
                      className="task-card-btn task-card-btn--delete"
                      onClick={() => {
                        onDismissQuest(task.id)
                        onClose()
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <button className="task-card-btn task-card-btn--flip" onClick={onFlip}>↺</button>
        </div>
      </div>

      {showAcceptConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">Are you sure want to accept this task?</p>
          <div className="task-card-confirm-actions">
            <button
              className="task-card-confirm-btn task-card-confirm-btn--yes"
              onClick={async () => {
                setShowAcceptConfirm(false)
                try {
                  await onAccept(task.id)
                  setShowAcceptSuccess(true)
                  setTimeout(() => onClose(), 2500)
                } catch {
                  setToastMsg('Failed to accept task. Please try again.')
                }
              }}
            >
              Yes
            </button>
            <button
              className="task-card-confirm-btn task-card-confirm-btn--no"
              onClick={() => setShowAcceptConfirm(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

      {showAcceptSuccess && (
        <div className="task-card-mode-overlay task-card-accept-success">
          <p className="task-card-accept-success-icon">✓</p>
          <p className="task-card-accept-success-title">Quest Accepted!</p>
          <p className="task-card-accept-success-sub">"{task.title}" has been added to your Quest list.</p>
          <p className="task-card-accept-success-sub">Good luck!</p>
        </div>
      )}

      {showSubmitSuccess && (
        <div className="task-card-mode-overlay task-card-accept-success">
          <p className="task-card-accept-success-icon">🎉</p>
          <p className="task-card-accept-success-title">Task Completed!</p>
          <p className="task-card-accept-success-sub">Coins will be rewarded to your account.</p>
        </div>
      )}

      {showP2PSubmitSuccess && (
        <div className="task-card-mode-overlay task-card-accept-success">
          <p className="task-card-accept-success-icon">📬</p>
          <p className="task-card-accept-success-title">Task Submitted!</p>
          <p className="task-card-accept-success-sub">Waiting for the creator to review your submission.</p>
        </div>
      )}

      {showCancelConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">
            {isCreatorView
              ? 'Are you sure you want to cancel this task?'
              : 'Are you sure want to cancel this quest?'}{'\n'}
            {isCreatorView
              ? 'It will be marked cancelled and can be deleted afterwards.'
              : 'It will be removed from your quest list.'}
          </p>
          <div className="task-card-confirm-actions">
            <button
              className="task-card-confirm-btn task-card-confirm-btn--yes"
              onClick={handleConfirmCancel}
            >
              Yes
            </button>
            <button
              className="task-card-confirm-btn task-card-confirm-btn--no"
              onClick={() => setShowCancelConfirm(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

      {showCancelSuccess && (
        <div className="task-card-mode-overlay task-card-accept-success">
          <p className="task-card-accept-success-icon">✓</p>
          <p className="task-card-accept-success-title">Quest Cancelled</p>
          <p className="task-card-accept-success-sub">Removed from your quest list.</p>
        </div>
      )}

      {showRejectSuccess && (
        <div className="task-card-mode-overlay task-card-accept-success">
          <p className="task-card-accept-success-icon">✕</p>
          <p className="task-card-accept-success-title">Submission Rejected</p>
          <p className="task-card-accept-success-sub">The assignee will be asked to redo the task.</p>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">Are you sure want to delete this task?</p>
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
      )}

      {showReassignConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">Re-assign this task? The current assignee will be removed.</p>
          <div className="task-card-confirm-actions">
            <button
              className="task-card-confirm-btn task-card-confirm-btn--yes"
              onClick={() => { handleReassign(); setShowReassignConfirm(false) }}
            >
              Yes
            </button>
            <button
              className="task-card-confirm-btn task-card-confirm-btn--no"
              onClick={() => setShowReassignConfirm(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

      {showConfirmReview && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">Are you sure you want to confirm this task as completed? Coins will be sent to the assignee.</p>
          <div className="task-card-confirm-actions">
            <button className="task-card-confirm-btn task-card-confirm-btn--yes" onClick={handleCreatorConfirm}>
              Yes
            </button>
            <button className="task-card-confirm-btn task-card-confirm-btn--no" onClick={() => setShowConfirmReview(false)}>
              No
            </button>
          </div>
        </div>
      )}

      {showRejectConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">Reject this submission? The assignee will be asked to redo the task.</p>
          <div className="task-card-confirm-actions">
            <button className="task-card-confirm-btn task-card-confirm-btn--yes" onClick={handleCreatorReject}>
              Yes
            </button>
            <button className="task-card-confirm-btn task-card-confirm-btn--no" onClick={() => setShowRejectConfirm(false)}>
              No
            </button>
          </div>
        </div>
      )}

      {showSubmitConfirm && (
        <div className="task-card-mode-overlay">
          <p className="task-card-confirm-text">
            {task.type === 'community'
              ? 'Mark this task as completed? Coins will be rewarded to your account.'
              : 'Are you sure you want to submit this task? You cannot cancel after submission.'}
          </p>
          <div className="task-card-confirm-actions">
            <button
              className="task-card-confirm-btn task-card-confirm-btn--yes"
              onClick={() => {
                setShowSubmitConfirm(false)
                if (task.type === 'community') {
                  onUpdateTask(task.id, { status: 'pending_review', submittedAt: new Date().toISOString() })
                  setShowSubmitSuccess(true)
                  setTimeout(() => {
                    setShowSubmitSuccess(false)
                    onDismissQuest?.(task.id)
                    onClose()
                  }, 2000)
                } else {
                  setShowP2PSubmitSuccess(true)
                  setTimeout(async () => {
                    setShowP2PSubmitSuccess(false)
                    try {
                      await onUpdateTask(task.id, { status: 'pending_confirmation', submittedAt: new Date().toISOString() })
                    } catch (err) {
                      setToastMsg(err?.response?.data?.error?.message ?? err?.message ?? 'Failed to submit task')
                    }
                  }, 2500)
                }
              }}
            >
              Yes
            </button>
            <button
              className="task-card-confirm-btn task-card-confirm-btn--no"
              onClick={() => setShowSubmitConfirm(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

      {toastMsg && <div className="task-card-toast">{toastMsg}</div>}

      <DisputeForm
        isOpen={showDisputeForm}
        onClose={() => setShowDisputeForm(false)}
        onSubmit={handleDisputeSubmit}
        pov={disputePov}
      />
    </div>
  )
}

export default TaskCardFront
