import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTasks } from '../../context/TasksContext';
import { useAcceptedTasks } from '../../context/AcceptedTasksContext';
import { useApp } from '../../context/AppContext';
import TaskCard from '../task/TaskCard';
import '../../styles/components/QuestSlider.css';

const ACTIVE_QUEST_STATUSES = ['open', 'active', 'pending_confirmation', 'pending_review', 'disputed'];

function QuestSlider({ onDetails }) {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id;
  const { tasks, updateTask } = useTasks();
  const { acceptedIds, submittedIds, cancelTask, submitTask } = useAcceptedTasks();
  const [currentIndex, setCurrentIndex] = useState(0);

  const questTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.type !== 'p2p' && t.type !== 'community') return false;
      if (!ACTIVE_QUEST_STATUSES.includes(t.status)) return false;
      return acceptedIds.has(t.id) || t.assignee?.id === currentUserId;
    });
  }, [tasks, acceptedIds, currentUserId]);

  const safeIndex = Math.min(currentIndex, Math.max(0, questTasks.length - 1));

  const intervalRef = useRef(null);

  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    if (questTasks.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % questTasks.length);
    }, 3000);
  }, [questTasks.length]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(intervalRef.current);
  }, [startTimer]);

  const handlePrev = () => {
    setCurrentIndex((i) => (i - 1 + questTasks.length) % questTasks.length);
    startTimer();
  };

  const handleNext = () => {
    setCurrentIndex((i) => (i + 1) % questTasks.length);
    startTimer();
  };

  const handleCancel = (id) => {
    const task = tasks.find((t) => t.id === id);
    cancelTask(id, task?.type);
    if (task?.type === 'p2p') {
      updateTask(id, { status: 'cancelled', assignee: null });
    }
  };

  const handleUpdate = (id, fields) => {
    const task = tasks.find((t) => t.id === id);
    if (task?.type === 'community' && fields.status === 'pending_review') {
      submitTask(id);
    } else {
      updateTask(id, fields);
    }
  };

  if (questTasks.length === 0) {
    return (
      <div className="quest-slider-section">
        <h2 className="quest-slider-title">Your Quests</h2>
        <div className="quest-slider-empty">
          <p>No active quests</p>
        </div>
      </div>
    );
  }

  const task = questTasks[safeIndex];

  return (
    <div className="quest-slider-section">
      <h2 className="quest-slider-title">Your Quests</h2>
      <div className="quest-slider">
        <button className="quest-slider-arrow" onClick={handlePrev}>‹</button>
        <div className="task-slider-container">
          <TaskCard
            key={task.id}
            task={task}
            index={safeIndex}
            showSourceBadge
            hideAccept
            isAccepted={acceptedIds.has(task.id)}
            isSubmitted={submittedIds.has(task.id)}
            onCancel={handleCancel}
            onUpdate={handleUpdate}
            onDetails={onDetails}
          />
        </div>
        <button className="quest-slider-arrow" onClick={handleNext}>›</button>
      </div>
    </div>
  );
}

export default QuestSlider;
