import { useCallback, useEffect, useReducer } from 'react';
import {
  fetchBroadcasts,
  createBroadcast,
  sendBroadcast,
  deleteBroadcast,
  updateBroadcast,
} from '../services/broadcastsService';
import type {
  Broadcast,
  CreateBroadcastPayload,
  UpdateBroadcastPayload,
} from '../services/broadcastsService';

// Model fetch lifecycle and the loaded collection together for reducer-based list updates.
type State =
  | { status: 'idle' | 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; broadcasts: Broadcast[] };

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; broadcasts: Broadcast[] }
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'PREPEND'; broadcast: Broadcast }
  | { type: 'UPDATE'; broadcast: Broadcast }
  | { type: 'REMOVE'; id: string };

// Centralize list changes so create, edit, delete, and fetch keep consistent state transitions.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading' };
    case 'FETCH_SUCCESS':
      return { status: 'success', broadcasts: action.broadcasts };
    case 'FETCH_ERROR':
      return { status: 'error', message: action.message };
    case 'PREPEND':
      if (state.status !== 'success') return state;
      return { ...state, broadcasts: [action.broadcast, ...state.broadcasts] };
    case 'UPDATE':
      if (state.status !== 'success') return state;
      return {
        ...state,
        broadcasts: state.broadcasts.map((b) =>
          b.id === action.broadcast.id ? action.broadcast : b,
        ),
      };
    case 'REMOVE':
      if (state.status !== 'success') return state;
      return { ...state, broadcasts: state.broadcasts.filter((b) => b.id !== action.id) };
    default:
      return state;
  }
}

export function useBroadcasts() {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });

  // Reload is also the recovery path for optimistic deletion failures.
  const load = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const broadcasts = await fetchBroadcasts();
      dispatch({ type: 'FETCH_SUCCESS', broadcasts });
    } catch (err) {
      dispatch({
        type: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to load broadcasts',
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Create persists first; failures bubble to the form so it can display validation feedback.
  const handleCreate = useCallback(async (payload: CreateBroadcastPayload) => {
    const created = await createBroadcast(payload); // throws on error — let caller handle
    dispatch({ type: 'PREPEND', broadcast: created });
    return created;
  }, []);

  // Hide the row immediately and restore the server list if deletion is rejected.
  const handleDelete = useCallback(
    async (id: string) => {
      dispatch({ type: 'REMOVE', id }); // optimistic
      try {
        await deleteBroadcast(id);
      } catch {
        load();
      }
    },
    [load],
  );

  // Sending is server-driven; replace the draft with the returned sent record on success.
  const handleSend = useCallback(async (id: string) => {
    const sent = await sendBroadcast(id); // throws on error — let caller handle
    dispatch({ type: 'UPDATE', broadcast: sent });
    return sent;
  }, []);

  // Apply edits from the canonical server response and let the caller handle errors.
  const handleUpdate = useCallback(async (id: string, patch: UpdateBroadcastPayload) => {
    const updated = await updateBroadcast(id, patch); // throws on error — let caller handle
    dispatch({ type: 'UPDATE', broadcast: updated });
    return updated;
  }, []);

  return {
    loading: state.status === 'idle' || state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
    broadcasts: state.status === 'success' ? state.broadcasts : [],
    reload: load,
    handleCreate,
    handleDelete,
    handleSend,
    handleUpdate,
  };
}
