import { useState, useMemo, useEffect, useRef } from 'react';

const ACTIVE_QUEST_STATUSES = ['open', 'active', 'pending_confirmation', 'pending_review', 'disputed', 'completed', 'expired'];
import '../../styles/components/MyTaskModal.css';
import useTaskManager from '../../hooks/useTaskManager';
import { useTasks } from '../../context/TasksContext';
import { useAcceptedTasks } from '../../context/AcceptedTasksContext';
import { useApp } from '../../context/AppContext';
import * as taskService from '../../services/taskService';
import { toFrontend } from '../../utils/taskMapper';
import { STATUS_B2F } from '../../utils/taskMapper';
import Toolbar from '../toolbar/Toolbar';
import loadIconSmall from '../../assets/load-icon-small.png';
import TaskGrid from '../task/TaskGrid';
import CreateEditForm from '../task/CreateEditForm';

function MyTaskModal({ onNavigate, questTargetId }) {
  const { currentUser, updateCoins } = useApp();
  const currentUserId = currentUser?.id;
  const { tasks, isLoading, createTask, updateTask, patchTask, deleteTask, refetch } = useTasks();

  // Shared loading state for manual tab switches.
  const [isTabLoading, setIsTabLoading] = useState(false);
  // Quest tab has its own loading state for the "navigate to quest" animation only.
  const [isLoadingQuest, setIsLoadingQuest] = useState(false);
  const [error] = useState(false);

  const createdTasks = useMemo(() =>
    tasks.filter((t) => (t.type === 'p2p' || t.type === 'mytask') && t.createdBy?.id === currentUserId),
    [tasks, currentUserId]);

  const {
    filteredTasks,
    filterStatus, setFilterStatus,
    sortBy, setSortBy,
    isEditMode, toggleEditMode,
    isDeleteMode, toggleDeleteMode,
    resetModes,
  } = useTaskManager(createdTasks);

  const [activeSubTab, setActiveSubTab] = useState('created');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const handledTargetRef = useRef(null);
  const tabLoadingTimeoutRef = useRef(null);

  useEffect(() => () => {
    if (tabLoadingTimeoutRef.current) {
      clearTimeout(tabLoadingTimeoutRef.current);
    }
  }, []);

  // Refetch on mount so creator sees up-to-date task statuses (e.g. pending_confirmation after assignee submits)
  useEffect(() => {
    refetch();
  }, []);

  useEffect(() => {
    if (questTargetId && questTargetId !== handledTargetRef.current) {
      handledTargetRef.current = questTargetId;
      // Defer state updates to avoid synchronous setState calls inside effect
      setTimeout(() => {
        setActiveSubTab('quest');
        setIsLoadingQuest(true);
        setExpandedTaskId(questTargetId);
        setTimeout(() => {
          setIsLoadingQuest(false);
          setTimeout(() => setExpandedTaskId(null), 50);
        }, 1000);
      }, 0);
    }
  }, [questTargetId]);

  const { acceptedIds, withdrawTask, cleanupCancelledTask, submittedIds, submitTask } = useAcceptedTasks();
  const [questSource, setQuestSource] = useState(null);
  const [questStatus, setQuestStatus] = useState(null);
  const [questSort, setQuestSort] = useState('');
  const [cancelledQuestIds, setCancelledQuestIds] = useState(new Set());

  const handleSubTabChange = (tab) => {
    if (tab === activeSubTab) return;
    if (tabLoadingTimeoutRef.current) {
      clearTimeout(tabLoadingTimeoutRef.current);
    }
    setIsTabLoading(true);
    setActiveSubTab(tab);
    resetModes();
    tabLoadingTimeoutRef.current = setTimeout(() => {
      setIsTabLoading(false);
      tabLoadingTimeoutRef.current = null;
    }, 350);
  };

  // Phase 1: API call only — no state changes so card stays mounted for success overlay.
  const handleCancelQuestApi = async (id) => {
    const task = tasks.find((t) => t.id === id);
    try {
      await withdrawTask(id, task?.type);
    } catch {
      // Withdrawal failed — still proceed to show success and hide from quest view
    }
  };

  // Phase 2: state cleanup — called after success overlay finishes (1500ms delay).
  const handleCancelQuestDone = (id) => {
    cleanupCancelledTask(id);
    setCancelledQuestIds((prev) => new Set([...prev, id]));
    // Refetch so the creator (Player B) sees the task reverted to cancelled/open
    refetch();
  };

  // Dismiss a completed SystemTask from quest list — local cleanup only, no backend delete.
  const handleDismissQuest = (id) => {
    cleanupCancelledTask(id);
    setCancelledQuestIds((prev) => new Set([...prev, id]));
  };

  const handleUpdateCard = async (id, fields) => {
    const task = tasks.find((t) => t.id === id);

    if (task?.type === 'p2p' && fields.status === 'completed') {
      const response = await taskService.confirmTask(id);
      const data = response?.data?.data;
      if (data?.task?.status) {
        updateTask(id, { status: STATUS_B2F[data.task.status] ?? data.task.status });
      }
      // Creator's escrow was already deducted at create time — no coin change needed here.
      return;
    }

    if (task?.type === 'p2p' && fields.status === 'active' && fields.rejectedAt) {
      const response = await taskService.rejectTaskSubmission(id);
      const data = response?.data?.data;
      const backendTask = data?.task;
      const backendAssignment = data?.assignment;
      if (backendTask?.status) {
        updateTask(id, {
          status: STATUS_B2F[backendTask.status] ?? backendTask.status,
          lastRejectedAt: backendAssignment?.rejectedAt ?? new Date().toISOString(),
        });
      }
      return;
    }

    if (task?.type === 'p2p' && fields.status === 'disputed') {
      const response = await taskService.disputeTask(id, {
        reason: fields.disputeReason,
        details: fields.disputeDetails ?? '',
      });
      const backendTask = response?.data?.data?.task;
      if (backendTask) {
        updateTask(id, {
          status: 'disputed',
          disputeRaisedBy: backendTask.disputeRaisedBy,
          disputeReason: backendTask.disputeReason,
          disputeDetails: backendTask.disputeDetails,
        });
      }
      return;
    }

    if (fields.status === 'cancelled') {
      const response = await taskService.cancelTask(id);
      const data = response?.data?.data;
      if (data?.task?.status) {
        updateTask(id, { status: STATUS_B2F[data.task.status] ?? data.task.status });
      }
      // Escrow refunded to creator — sync creator coins if returned.
      if (data?.coins !== undefined) updateCoins(data.coins);
      return;
    }

    // Re-assign: re-open a cancelled task via API, clear assignee in local state.
    if (fields.status === 'open' && fields.assignee === null) {
      const response = await taskService.reopenTask(id);
      const backendTask = response?.data?.data?.task;
      if (backendTask) {
        updateTask(id, { ...toFrontend(backendTask), assignee: null });
      }
      return;
    }

    // If task is being submitted, call API first to sync status from backend.
    if (fields.status === 'pending_review' || fields.status === 'pending_confirmation') {
      try {
        const data = await submitTask(id);
        if (data?.task?.status) {
          updateTask(id, { status: STATUS_B2F[data.task.status] ?? data.task.status });
        }
      } catch {
        // Submit failed — task stays in current state
      }
    } else {
      // For non-submit updates, just update local state.
      updateTask(id, fields);
    }
  };

  // Submit action: call API and sync returned task status to local state.
  // All other field updates are local-only (no PATCH endpoint in backend yet).
  const handleQuestUpdate = async (id, fields) => {
    if (fields.status === 'disputed') {
      const task = tasks.find((t) => t.id === id);
      if (task?.type === 'p2p') {
        const response = await taskService.disputeTask(id, {
          reason: fields.disputeReason,
          details: fields.disputeDetails ?? '',
        });
        const backendTask = response?.data?.data?.task;
        if (backendTask) {
          updateTask(id, {
            status: 'disputed',
            disputeRaisedBy: backendTask.disputeRaisedBy,
            disputeReason: backendTask.disputeReason,
            disputeDetails: backendTask.disputeDetails,
          });
        }
      }
      return;
    }

    if (fields.status === 'pending_review' || fields.status === 'pending_confirmation') {
      const data = await submitTask(id);
      const task = tasks.find((t) => t.id === id);
      if (task?.type === 'community') {
        // Community submit gives coins immediately — sync balance if returned
        if (data?.coinsAwarded !== undefined && currentUser?.coins !== undefined) {
          updateCoins(currentUser.coins + data.coinsAwarded);
        }
        // Mark isCompletedByMe so System tab hides this task on next view
        updateTask(id, { isCompletedByMe: true });
        // Mark as dismissed immediately so the card auto-hides after the success overlay
        setCancelledQuestIds((prev) => new Set([...prev, id]));
        cleanupCancelledTask(id);
      } else if (data?.task?.status) {
        updateTask(id, { status: STATUS_B2F[data.task.status] ?? data.task.status });
      }
    } else {
      updateTask(id, fields);
    }
  };

  const filteredQuest = useMemo(() => {
    let result = tasks.filter((t) => {
      if (t.type !== 'p2p' && t.type !== 'community') return false;
      if (t.createdBy?.id === currentUserId) return false;
      if (cancelledQuestIds.has(t.id)) return false;
      const isDisputeResolved = t.status === 'cancelled' && t.type === 'p2p' && t.disputeRaisedBy;
      if (!ACTIVE_QUEST_STATUSES.includes(t.status) && !isDisputeResolved) return false;
      const iExplicitlyAccepted = acceptedIds.has(t.id);
      const isAssignedToMe = t.assignee?.id === currentUserId;
      return iExplicitlyAccepted || isAssignedToMe;
    });
    if (questSource) result = result.filter((t) => t.type === questSource);
    if (questStatus === 'pending_review') {
      result = result.filter((t) =>
        t.status === 'pending_review' ||
        t.status === 'pending_confirmation'
      );
    } else if (questStatus === 'active') {
      result = result.filter((t) => t.status === 'active' || (t.status === 'open' && acceptedIds.has(t.id)));
    } else if (questStatus === 'rejected') {
      result = result.filter((t) => t.status === 'active' && t.rejectedAt);
    } else if (questStatus === 'cancelled') {
      result = result.filter((t) => t.status === 'cancelled' && t.disputeRaisedBy);
    } else if (questStatus) {
      result = result.filter((t) => t.status === questStatus);
    }
    if (questSort === 'reward-high') result.sort((a, b) => b.rewardCoins - a.rewardCoins);
    if (questSort === 'reward-low') result.sort((a, b) => a.rewardCoins - b.rewardCoins);
    if (questSort === 'timelimit-long') result.sort((a, b) => b.timeLimit - a.timeLimit);
    if (questSort === 'timelimit-short') result.sort((a, b) => a.timeLimit - b.timeLimit);
    if (questSort === 'expiry-early') result.sort((a, b) => new Date(a.expiredAt) - new Date(b.expiredAt));
    if (questSort === 'expiry-late') result.sort((a, b) => new Date(b.expiredAt) - new Date(a.expiredAt));
    return result;
  }, [tasks, questSource, questStatus, questSort, cancelledQuestIds, acceptedIds, currentUserId]);

  const handleQuestSourceFilter = (source) => {
    setQuestSource((prev) => (prev === source ? null : source));
  };

  const handleQuestStatusFilter = (status) => {
    setQuestStatus(status === 'all' ? null : status);
  };

  const handleCreate = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormSubmit = async (taskData) => {
    if (editingTask) {
      await patchTask(taskData.id, taskData);
    } else {
      const created = await createTask(taskData);
      if (created?._coins !== undefined) {
        updateCoins(created._coins);
      }
    }
  };

  const subtabButtons = (
    <div className="subtab-row">
      <button
        className={`subtab-btn ${activeSubTab === 'created' ? 'subtab-btn--active' : ''}`}
        onClick={() => handleSubTabChange('created')}
      >
        Created
      </button>
      <button
        className={`subtab-btn ${activeSubTab === 'quest' ? 'subtab-btn--active' : ''}`}
        onClick={() => handleSubTabChange('quest')}
      >
        Quest
      </button>
    </div>
  );

  const skeletonLoader = (
    <div className="task-loading-state">
      <img src={loadIconSmall} alt="" className="task-loading-icon" />
      <p className="task-loading-title">Loading...</p>
      <p className="task-loading-sub">Fetching tasks...</p>
    </div>
  );

  const errorState = (
    <div className="task-error-state">
      <p className="task-error-icon">⚠️</p>
      <p className="task-error-title">Oops!</p>
      <p className="task-error-msg">Failed to load tasks</p>
    </div>
  );

  const renderContent = () => {
    if (error) return errorState;
    if (isTabLoading) return skeletonLoader;

    if (activeSubTab === 'created') {
      if (isLoading) return skeletonLoader;
      if (filteredTasks.length === 0) {
        const hasFilter = filterStatus !== 'all' || sortBy !== '';
        if (hasFilter) {
          return (
            <div className="task-empty-state">
              <p className="task-empty-title">🔍 No tasks found</p>
              <p className="task-empty-sub">No tasks match the current filter.</p>
            </div>
          );
        }
        return (
          <div className="task-empty-state">
            <p className="task-empty-title">📝 No tasks created yet</p>
            <p className="task-empty-sub">Tap + to create your first task!</p>
            <button className="task-empty-create-btn" onClick={handleCreate}>+</button>
          </div>
        );
      }
      return (
        <TaskGrid
          tasks={filteredTasks}
          taskType="mytask"
          isCreatorView={true}
          onCreateClick={handleCreate}
          isEditMode={isEditMode}
          isDeleteMode={isDeleteMode}
          onEditCard={handleEdit}
          onDeleteCard={deleteTask}
          onUpdateCard={handleUpdateCard}
        />
      );
    }

    if (isLoadingQuest) return skeletonLoader;

    if (filteredQuest.length === 0) {
      const hasFilter = questStatus !== null || questSource !== null;
      if (hasFilter) {
        return (
          <div className="task-empty-state">
            <p className="task-empty-title">🔍 No quests found</p>
            <p className="task-empty-sub">No quests match the current filter.</p>
          </div>
        );
      }
      return (
        <div className="task-empty-state">
          <p className="task-empty-title">🎯 No active quests</p>
          <p className="task-empty-sub">Accept a task from P2P or System to get started!</p>
          <div className="task-empty-nav-btns">
            <button className="task-empty-nav-btn" onClick={() => onNavigate?.('p2p')}>P2P Tasks</button>
            <button className="task-empty-nav-btn" onClick={() => onNavigate?.('community')}>System Tasks</button>
          </div>
        </div>
      );
    }

    return (
      <TaskGrid
        tasks={filteredQuest}
        taskType="quest"
        acceptedIds={acceptedIds}
        submittedIds={submittedIds}
        onCancelCard={handleCancelQuestApi}
        onCancelDone={handleCancelQuestDone}
        onUpdateCard={handleQuestUpdate}
        onDismissQuest={handleDismissQuest}
        expandedTaskId={expandedTaskId}
      />
    );
  };

  return (
    <>
      <div className="mytask-toolbar-row">
        {subtabButtons}
        {!isTabLoading && !isLoading && !error && activeSubTab === 'created' && (
          <Toolbar
            taskType="mytask"
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onCreateClick={handleCreate}
            isEditMode={isEditMode}
            onEditToggle={toggleEditMode}
            isDeleteMode={isDeleteMode}
            onDeleteToggle={toggleDeleteMode}
            onHelpClick={() => setShowHelp(true)}
          />
        )}
        {!isTabLoading && !isLoadingQuest && !error && activeSubTab === 'quest' && (
          <Toolbar
            taskType="quest"
            questMode
            filterStatus={questStatus}
            onFilterChange={handleQuestStatusFilter}
            sortBy={questSort}
            onSortChange={setQuestSort}
            sourceFilter={questSource}
            onSourceFilter={handleQuestSourceFilter}
            onHelpClick={() => setShowHelp(true)}
          />
        )}
      </div>

      {activeSubTab === 'created' && (isEditMode || isDeleteMode) && !isTabLoading && !isLoading && !error && (
        <p className="mode-hint">
          {isEditMode
            ? '✏ Move cursor to the card to edit'
            : '🗑 Move cursor to the card to delete'}
        </p>
      )}

      {renderContent()}

      {showForm && (
        <CreateEditForm
          onClose={() => setShowForm(false)}
          onSubmit={handleFormSubmit}
          initialData={editingTask}
        />
      )}

      {showHelp && (
        <div className="task-modal-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="task-modal-help-box" onClick={(e) => e.stopPropagation()}>
            {activeSubTab === 'created' ? (
              <>
                <h3 className="task-modal-help-title">How Created Tasks Works</h3>
                <ul className="task-modal-help-list">
                  <li>Create P2P tasks and assign them to other players</li>
                  <li>Click Edit mode then hover a card to edit it</li>
                  <li>Click Delete mode then hover a card to delete it</li>
                  <li>Confirm or reject submissions from your assignees</li>
                  <li>Raise a dispute if you disagree with a submission</li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="task-modal-help-title">How Quest Works</h3>
                <ul className="task-modal-help-list">
                  <li>View all tasks you have accepted from P2P or System</li>
                  <li>Submit a task once you have completed it</li>
                  <li>Raise a dispute if your submission was rejected unfairly</li>
                  <li>Filter by status or source to find specific quests</li>
                </ul>
              </>
            )}
            <button className="task-modal-help-close" onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MyTaskModal;
