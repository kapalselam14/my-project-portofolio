import { useState, useMemo } from 'react';

function useTaskManager(tasks) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterStatus !== 'all') {
      result = result.filter((t) => t.status === filterStatus);
    }

    switch (sortBy) {
      case 'reward-high':   result.sort((a, b) => b.rewardCoins - a.rewardCoins); break;
      case 'reward-low':    result.sort((a, b) => a.rewardCoins - b.rewardCoins); break;
      case 'timelimit-long':  result.sort((a, b) => b.timeLimit - a.timeLimit); break;
      case 'timelimit-short': result.sort((a, b) => a.timeLimit - b.timeLimit); break;
      case 'expiry-early':  result.sort((a, b) => new Date(a.expiredAt) - new Date(b.expiredAt)); break;
      case 'expiry-late':   result.sort((a, b) => new Date(b.expiredAt) - new Date(a.expiredAt)); break;
      default: break;
    }

    return result;
  }, [tasks, filterStatus, sortBy]);

  const toggleEditMode = () => { setIsEditMode((prev) => !prev); setIsDeleteMode(false); };
  const toggleDeleteMode = () => { setIsDeleteMode((prev) => !prev); setIsEditMode(false); };
  const resetModes = () => { setIsEditMode(false); setIsDeleteMode(false); };

  return {
    filteredTasks,
    filterStatus, setFilterStatus,
    sortBy, setSortBy,
    isEditMode, toggleEditMode,
    isDeleteMode, toggleDeleteMode,
    resetModes,
  };
}

export default useTaskManager;
