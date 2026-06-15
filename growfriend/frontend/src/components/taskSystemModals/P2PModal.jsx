import { useState, useMemo } from 'react';
import useTaskManager from '../../hooks/useTaskManager';
import { useTasks } from '../../context/TasksContext';
import Toolbar from '../toolbar/Toolbar';
import TaskGrid from '../task/TaskGrid';
import { useAcceptedTasks } from '../../context/AcceptedTasksContext';
import loadIconSmall from '../../assets/load-icon-small.png';

function P2PModal() {
  const { tasks, isLoading, error, refetch, updateTask } = useTasks();

  const p2pData = useMemo(() =>
    tasks.filter((t) => t.type === 'p2p' && t.status === 'open'),
    [tasks]);

  const {
    filteredTasks,
    filterStatus, setFilterStatus,
    sortBy, setSortBy,
  } = useTaskManager(p2pData);

  const { acceptedIds, acceptTask } = useAcceptedTasks();
  const [showHelp, setShowHelp] = useState(false);

  // P2P accept is direct assignment — backend immediately sets task to IN_PROGRESS.
  // Delay status update so the success overlay in TaskCardFront has time to display (2500ms),
  // then update local state and refetch so the task moves to Quest tab.
  const handleAccept = async (id) => {
    await acceptTask(id);
    setTimeout(() => {
      updateTask(id, { status: 'active' });
      refetch();
    }, 2500);
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
            taskType="p2p"
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onHelpClick={() => setShowHelp(true)}
          />

          {filteredTasks.length === 0 ? (
            (filterStatus !== 'all' || sortBy !== '') ? (
              <div className="task-empty-state">
                <p className="task-empty-title">🔍 No tasks found</p>
                <p className="task-empty-sub">No tasks match the current filter.</p>
              </div>
            ) : (
              <div className="task-empty-state">
                <p className="task-empty-title">📭 No P2P tasks available</p>
                <p className="task-empty-sub">Check back later for new tasks!</p>
              </div>
            )
          ) : (
            <TaskGrid
              tasks={filteredTasks}
              taskType="p2p"
              acceptedIds={acceptedIds}
              onAcceptCard={handleAccept}
            />
          )}
        </>
      )}

      {showHelp && (
        <div className="task-modal-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="task-modal-help-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="task-modal-help-title">How P2P Tasks Works</h3>
            <ul className="task-modal-help-list">
              <li>Browse tasks created by other players</li>
              <li>Click Details then Accept to take a task</li>
              <li>Filter by status to find open tasks</li>
              <li>Sort by reward to find the best tasks</li>
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

export default P2PModal;
