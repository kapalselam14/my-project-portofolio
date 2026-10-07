// useActivities (hooks).
import { useCallback, useEffect, useReducer } from 'react';
import {
  fetchActivities,
  updateActivityStatus,
  deleteActivity,
} from '../services/activitiesService';
import type { AdminActivity, ActivityStatus } from '../services/activitiesService';

// Keep loading, error, and loaded data mutually exclusive so callers can render each state cleanly.
type State =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; activities: AdminActivity[] };

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; activities: AdminActivity[] }
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'UPDATE_STATUS'; id: string; activityStatus: ActivityStatus }
  | { type: 'REMOVE'; id: string };

// Apply fetch results and local edits without mutating the current activity list.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', activities: action.activities };
    case 'FETCH_ERROR':
      return { status: 'error', message: action.message };
    case 'UPDATE_STATUS':
      if (state.status !== 'success') return state;
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id ? { ...a, status: action.activityStatus } : a,
        ),
      };
    case 'REMOVE':
      if (state.status !== 'success') return state;
      return { ...state, activities: state.activities.filter((a) => a.id !== action.id) };
    default:
      return state;
  }
}

export function useActivities() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // Fetching is shared by initial load, manual reloads, and mutation recovery.
  const load = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const activities = await fetchActivities();
      dispatch({ type: 'FETCH_SUCCESS', activities });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to load activities',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Update immediately for a responsive UI; reload the server version if persistence fails.
  const handleStatusChange = useCallback(
    async (id: string, activityStatus: ActivityStatus) => {
      dispatch({ type: 'UPDATE_STATUS', id, activityStatus });
      try {
        await updateActivityStatus(id, activityStatus);
      } catch {
        load();
      }
    },
    [load],
  );

  // Remove immediately, then restore server data on failure by reloading.
  const handleDelete = useCallback(
    async (id: string) => {
      dispatch({ type: 'REMOVE', id });
      try {
        await deleteActivity(id);
      } catch {
        load();
      }
    },
    [load],
  );

  return {
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
    activities: state.status === 'success' ? state.activities : [],
    reload: load,
    handleStatusChange,
    handleDelete,
  };
}
