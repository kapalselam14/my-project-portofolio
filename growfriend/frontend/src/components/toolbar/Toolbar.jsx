import '../../styles/components/Toolbar.css';

function Toolbar({
  taskType,
  filterStatus,
  onFilterChange,
  sortBy,
  onSortChange,
  onCreateClick,
  isEditMode,
  onEditToggle,
  isDeleteMode,
  onDeleteToggle,
  onHelpClick,
  questMode = false,
  sourceFilter = null,
  onSourceFilter = () => {},
}) {
  const isFilterActive = questMode ? (sourceFilter !== null || filterStatus !== null) : filterStatus !== 'all';
  const isSortActive = sortBy !== '';
  const showReset = isFilterActive || isSortActive;

  const handleReset = () => {
    if (!questMode) onFilterChange('all');
    else onFilterChange(null);
    onSortChange('');
    onSourceFilter(null);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-controls">
        <div className="toolbar-row">
          {showReset && (
            <button className="toolbar-btn toolbar-btn--reset" onClick={handleReset} title="Reset">
              ↺
            </button>
          )}

          {questMode && (
            <>
              <button
                className={`toolbar-btn toolbar-btn--p2p ${sourceFilter === 'p2p' ? 'toolbar-btn--p2p-active' : ''}`}
                onClick={() => onSourceFilter('p2p')}
              >
                P2P
              </button>
              <button
                className={`toolbar-btn toolbar-btn--comm ${sourceFilter === 'community' ? 'toolbar-btn--comm-active' : ''}`}
                onClick={() => onSourceFilter('community')}
              >
                System
              </button>
              <select
                className={`toolbar-select ${isFilterActive ? 'toolbar-select--active' : ''}`}
                value={filterStatus ?? 'all'}
                onChange={(e) => onFilterChange(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending_review">Pending Review</option>
                <option value="disputed">Disputed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </>
          )}

          {!questMode && taskType !== 'p2p' && taskType !== 'community' && (
            <select
              className={`toolbar-select ${isFilterActive ? 'toolbar-select--active' : ''}`}
              value={filterStatus}
              onChange={(e) => onFilterChange(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              {taskType !== 'community' && <option value="active">Active</option>}
              {taskType === 'mytask' && <option value="pending_review">Pending Review</option>}
              {taskType === 'mytask' && <option value="disputed">Disputed</option>}
              {taskType === 'mytask' && <option value="completed">Completed</option>}
              {taskType !== 'community' && taskType !== 'p2p' && <option value="cancelled">Cancelled</option>}
              {taskType !== 'p2p' && <option value="expired">Expired</option>}
            </select>
          )}

          <select
            className={`toolbar-select ${isSortActive ? 'toolbar-select--active' : ''}`}
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="">Sort by...</option>
            <optgroup label="Reward">
              <option value="reward-high">Highest</option>
              <option value="reward-low">Lowest</option>
            </optgroup>
            <optgroup label="Time Limit">
              <option value="timelimit-long">Longest</option>
              <option value="timelimit-short">Shortest</option>
            </optgroup>
            <optgroup label="Expiry Date">
              <option value="expiry-early">Earliest</option>
              <option value="expiry-late">Latest</option>
            </optgroup>
          </select>
        </div>

        <div className="toolbar-row">
          {taskType === 'mytask' && (
            <>
              <button className="toolbar-btn toolbar-btn--create" onClick={onCreateClick}>
                + Create
              </button>
              <button
                className={`toolbar-btn toolbar-btn--edit ${isEditMode ? 'toolbar-btn--active' : ''}`}
                onClick={onEditToggle}
              >
                Edit
              </button>
              <button
                className={`toolbar-btn toolbar-btn--delete ${isDeleteMode ? 'toolbar-btn--active' : ''}`}
                onClick={onDeleteToggle}
              >
                Delete
              </button>
            </>
          )}
          <button className="toolbar-btn toolbar-btn--help" onClick={onHelpClick}>
            ?
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;