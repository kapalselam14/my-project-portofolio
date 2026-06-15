import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as taskService from '../services/taskService';
import { toFrontend, toFrontendList, userCreateToBackend } from '../utils/taskMapper';
import { useApp } from './AppContext';
import { useAcceptedTasks } from './AcceptedTasksContext';

const TasksContext = createContext();

export function TasksProvider({ children }) {
    const { currentUser } = useApp();
    const { initAcceptedIds, resetAcceptedState } = useAcceptedTasks();
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Fetch in parallel:
                // 1. mine=true → personal tasks, p2p (created/assigned), system tasks already accepted
                // 2. type=SYSTEM → all public SYSTEM tasks visible to every player
                // 3. type=P2P, status=OPEN → all open P2P tasks visible to every player (public marketplace)
                const [mineRes, systemRes, p2pRes] = await Promise.all([
                    taskService.getTasks({ mine: true }),
                    taskService.getTasks({ type: 'community' }),
                    taskService.getTasks({ type: 'p2p', status: 'open' }),
                ]);
                const mineTasks = toFrontendList(mineRes.data.data.tasks);
                const systemTasks = toFrontendList(systemRes.data.data.tasks);
                const p2pTasks = toFrontendList(p2pRes.data.data.tasks);
                // Merge: deduplicate by id, mine tasks take precedence (carry assignee info)
                const mineIds = new Set(mineTasks.map((t) => t.id));
                const merged = [
                    ...mineTasks,
                    ...systemTasks.filter((t) => !mineIds.has(t.id)),
                    ...p2pTasks.filter((t) => !mineIds.has(t.id)),
                ];
                setTasks(merged);
                initAcceptedIds(merged);
            } else {
                const res = await taskService.getTasks({});
                setTasks(toFrontendList(res.data.data.tasks));
            }
        } catch (err) {
            setError(err.response?.data?.error?.message ?? 'Failed to load tasks');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Re-fetch whenever the logged-in user changes (login / logout).
    // Reset accepted state first so stale IDs from a previous session don't carry over.
    useEffect(() => {
        if (!currentUser?.id) {
            resetAcceptedState();
            setTasks([]);
            return;
        }
        fetchTasks();
    }, [currentUser?.id]);

    // Creates a task via API, maps response back to frontend shape, prepends to list.
    // Returns the created task or throws on failure.
    const createTask = useCallback(async (formData) => {
        const body = userCreateToBackend(formData);
        const res = await taskService.createTask(body);
        const created = toFrontend(res.data.data.task);
        setTasks((prev) => [created, ...prev]);
        // Pass coins balance back so caller can sync AppContext (P2P escrow deduction)
        return { ...created, _coins: res.data.data.coins };
    }, []);

    // Local-only updater — called by modals after their own API calls to sync UI.
    // Does NOT hit the backend.
    const updateTask = useCallback((id, fields) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    }, []);

    // Calls PATCH /api/tasks/:id, then merges the returned task into local state.
    // Maps frontend form fields (instructions→description, expiredAt→endAt) before sending.
    // Preserves frontend-only fields (category, difficulty, etc.) that backend doesn't store.
    const patchTask = useCallback(async (id, fields) => {
        const body = {};
        if (fields.title !== undefined) body.title = fields.title;
        if (fields.instructions !== undefined) body.description = fields.instructions;
        else if (fields.description !== undefined) body.description = fields.description;
        if (fields.objectives !== undefined) body.objectives = Array.isArray(fields.objectives) ? fields.objectives.filter(o => String(o).trim()) : [];
        if (fields.timeLimit !== undefined) body.timeLimit = fields.timeLimit ? Number(fields.timeLimit) : null;
        if (fields.category !== undefined) body.category = fields.category;
        if (fields.rewardCoins !== undefined) body.rewardCoins = Number(fields.rewardCoins);
        if (fields.expiredAt !== undefined) body.endAt = fields.expiredAt;
        const res = await taskService.patchTask(id, body);
        const updated = toFrontend(res.data.data.task);
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
        return updated;
    }, []);

    // Calls DELETE /api/tasks/:id, then removes from local state.
    // Throws on API failure so callers can show an error.
    const deleteTask = useCallback(async (id) => {
        await taskService.deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <TasksContext.Provider
            value={{ tasks, isLoading, error, createTask, updateTask, patchTask, deleteTask, refetch: fetchTasks }}
        >
            {children}
        </TasksContext.Provider>
    );
}

export function useTasks() {
    return useContext(TasksContext);
}
