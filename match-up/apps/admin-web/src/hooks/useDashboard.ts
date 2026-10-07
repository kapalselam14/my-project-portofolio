import { useCallback, useEffect, useReducer } from 'react';
import { fetchDashboard, moderationAction, type ModAction } from '../services/dashboardService';
import type { DashboardData, ModerationItem } from '../types/dashboard';

// State & reducer: dashboard data is available only after a successful fetch.

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: DashboardData };

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: DashboardData }
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'REMOVE_MOD_ITEM'; id: string };

// Keep queue updates immutable so React can observe the moderation-list change.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.data };
    case 'FETCH_ERROR':
      return { status: 'error', message: action.message };
    case 'REMOVE_MOD_ITEM':
      if (state.status !== 'success') return state;
      return {
        ...state,
        data: {
          ...state.data,
          moderationQueue: state.data.moderationQueue.filter(
            (m: ModerationItem) => m.id !== action.id,
          ),
        },
      };
    default:
      return state;
  }
}

// Hook.

export function useDashboard() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // Initial load and failed-action recovery both use the same fetch path.
  const load = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await fetchDashboard();
      dispatch({ type: 'FETCH_SUCCESS', data });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to load dashboard',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Optimistically removes the item, then fires the API. Re-fetches on error. */
  const handleModAction = useCallback(
    async (id: string, action: ModAction, note?: string) => {
      dispatch({ type: 'REMOVE_MOD_ITEM', id });
      try {
        await moderationAction(id, action, note);
      } catch {
        load();
      }
    },
    [load],
  );

  const data = state.status === 'success' ? state.data : null;

  return {
    loading: state.status === 'loading' || state.status === 'idle',
    error: state.status === 'error' ? state.message : null,
    data,
    reload: load,
    handleModAction,
  };
}
