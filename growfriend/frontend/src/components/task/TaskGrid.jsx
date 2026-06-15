import TaskCard from './TaskCard';
import '../../styles/components/TaskGrid.css';

function TaskGrid({
  tasks,
  taskType,
  onCreateClick,
  isEditMode = false,
  isDeleteMode = false,
  onEditCard,
  onDeleteCard,
  onUpdateCard,
  onCancelCard,
  onCancelDone,
  acceptedIds,
  submittedIds,
  onAcceptCard,
  isCreatorView = false,
  expandedTaskId,
  onDismissQuest,
}) {
  const showCreateSlot = isCreatorView && onCreateClick;

  return (
    <div className="task-grid">
      {tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          isEditMode={isEditMode}
          isDeleteMode={isDeleteMode}
          onEdit={onEditCard}
          onDelete={onDeleteCard}
          onUpdate={onUpdateCard}
          showSourceBadge={taskType === 'quest'}
          hideAccept={taskType === 'quest'}
          onCancel={taskType === 'quest' ? onCancelCard : undefined}
          onCancelDone={taskType === 'quest' ? onCancelDone : undefined}
          isAccepted={task.isAcceptedByMe || (acceptedIds ? acceptedIds.has(task.id) : false)}
          isSubmitted={submittedIds ? submittedIds.has(task.id) : false}
          onAccept={onAcceptCard}
          isCreatorView={isCreatorView}
          initialExpanded={expandedTaskId === task.id}
          onDismissQuest={taskType === 'quest' ? onDismissQuest : undefined}
        />
      ))}

      {showCreateSlot && (
        <button className="task-grid-create-slot" onClick={onCreateClick}>
          <span className="task-grid-create-icon">+</span>
        </button>
      )}
    </div>
  );
}

export default TaskGrid;
