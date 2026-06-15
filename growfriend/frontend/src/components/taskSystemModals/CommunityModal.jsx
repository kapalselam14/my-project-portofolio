// Note: this file handles SystemTask (previously called Community)
import { useState, useMemo } from 'react';
import useTaskManager from '../../hooks/useTaskManager';
import { useTasks } from '../../context/TasksContext';
import Toolbar from '../toolbar/Toolbar';
import TaskGrid from '../task/TaskGrid';
import { useAcceptedTasks } from '../../context/AcceptedTasksContext';
import loadIconSmall from '../../assets/load-icon-small.png';

function CommunityModal() {
  const { tasks, isLoading, error, refetch } = useTasks();

  const communityData = useMemo(
    () => tasks.filter((t) => t.type === 'community' && t.status !== 'expired' && !t.isCompletedByMe),
    [tasks]
  );

  const {
    filteredTasks,
    filterStatus, setFilterStatus,
    sortBy, setSortBy,
  } = useTaskManager(communityData);

  const { acceptedIds, acceptTask } = useAcceptedTasks();
  const [showHelp, setShowHelp] = useState(false);

  const handleAccept = async (id) => {
    try {
      await acceptTask(id);
    } catch {
      // API error — AcceptedTasksContext already rolled back acceptedIds
    }
  };

  return (
    <>
      {isLoading && (
        <div className="task-loading-state">
          <img src={loadIconSmall} alt="" className="task-loading-icon" />
          <p className="task-loading-title">Loading...</p>
          <p className="task-loading-sub">Fetching tasks...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="task-error-state">
          <p className="task-error-icon">⚠️</p>
          <p className="task-error-title">Oops!</p>
          <p className="task-error-msg">Failed to load tasks</p>
          <button className="task-error-retry" onClick={refetch}>Try Again</button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          <Toolbar
            taskType="community"
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onHelpClick={() => setShowHelp(true)}
          />

          {filteredTasks.length === 0 ? (
            <div className="task-empty-state">
              <p className="task-empty-title">🏛️ No system tasks available</p>
              <p className="task-empty-sub">New system tasks will appear here soon!</p>
            </div>
          ) : (
            <TaskGrid
              tasks={filteredTasks}
              taskType="community"
              acceptedIds={acceptedIds}
              onAcceptCard={handleAccept}
            />
          )}
        </>
      )}

      {showHelp && (
        <div className="task-modal-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="task-modal-help-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="task-modal-help-title">How System Tasks Works</h3>
            <ul className="task-modal-help-list">
              <li>Browse tasks created by GrowFriend admins</li>
              <li>Click Details then Accept to take a task</li>

            </ul>
            <button className="task-modal-help-close" onClick={() => setShowHelp(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default CommunityModal;
