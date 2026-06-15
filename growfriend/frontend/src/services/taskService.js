import api from './api';
import { TYPE_F2B, STATUS_F2B } from '../utils/taskMapper';

// ─── Read ────────────────────────────────────────────────────────────────────

/** GET /api/tasks
 * Accepts frontend-convention strings — mapping to backend enums is done here.
 * @param {object} params - optional query params: type, status, mine
 * Examples:
 *   getTasks({ type: 'community' })            → GET /api/tasks?type=SYSTEM
 *   getTasks({ type: 'p2p', status: 'open' })  → GET /api/tasks?type=P2P&status=OPEN
 *   getTasks({ mine: true })                   → tasks created by or assigned to current user
 */
export const getTasks = (params = {}) => {
  const mapped = { ...params };
  if (mapped.type)   mapped.type   = TYPE_F2B[mapped.type]   ?? mapped.type;
  if (mapped.status) mapped.status = STATUS_F2B[mapped.status] ?? mapped.status;
  return api.get('/tasks', { params: mapped });
};

/** GET /api/tasks/:id */
export const getTask = (id) =>
  api.get(`/tasks/${id}`);

// ─── Write ───────────────────────────────────────────────────────────────────

/** POST /api/tasks
 * body must be already mapped via userCreateToBackend()
 */
export const createTask = (body) =>
  api.post('/tasks', body);

/** POST /api/tasks/:id/apply  — direct assignment */
export const applyForTask = (id) =>
  api.post(`/tasks/${id}/apply`);

/** DELETE /api/tasks/:id/assignment  — player withdraws from a SYSTEM task assignment */
export const withdrawAssignment = (id) =>
  api.delete(`/tasks/${id}/assignment`);

/** POST /api/tasks/:id/abandon  — P2P assignee abandons an active task, reverts task to OPEN */
export const abandonP2PTask = (id) =>
  api.post(`/tasks/${id}/abandon`);

/** POST /api/tasks/:id/submit
 * - PERSONAL → auto-completes
 * - SYSTEM / P2P → moves to PENDING_CONFIRMATION
 */
export const submitTask = (id) =>
  api.post(`/tasks/${id}/submit`);

/** POST /api/tasks/:id/confirm
 * - SYSTEM: admin only
 * - P2P: task creator only (or admin)
 * Awards coins to assignee.
 */
export const confirmTask = (id) =>
  api.post(`/tasks/${id}/confirm`);

/** POST /api/tasks/:id/reject
 * - SYSTEM: admin only
 * - P2P: task creator only (or admin)
 * Returns task to IN_PROGRESS so the assignee can redo it.
 */
export const rejectTaskSubmission = (id) =>
  api.post(`/tasks/${id}/reject`);

/** POST /api/tasks/:id/cancel
 * Creator or admin. Refunds P2P escrow if still HELD.
 */
export const cancelTask = (id) =>
  api.post(`/tasks/${id}/cancel`);

/** POST /api/tasks/:id/reopen
 * Creator or admin. Re-opens a CANCELLED task back to OPEN, clears assignments.
 */
export const reopenTask = (id) =>
  api.post(`/tasks/${id}/reopen`);

/** PATCH /api/tasks/:id
 * body: { title?, description?, endAt?, rewardCoins? }
 * P2P: rewardCoins ignored by backend (escrow locked at create time).
 * Only when OPEN (P2P/SYSTEM) or IN_PROGRESS (PERSONAL).
 */
export const patchTask = (id, body) =>
  api.patch(`/tasks/${id}`, body);

/** DELETE /api/tasks/:id
 * SYSTEM: admin only. P2P/PERSONAL: creator only.
 * Only when status OPEN or CANCELLED. P2P auto-refunds escrow.
 */
export const deleteTask = (id) =>
  api.delete(`/tasks/${id}`);

/** POST /api/tasks/:id/dispute
 * Creator or assignee raises a dispute on an active/pending P2P task.
 * @param {string} id - task id
 * @param {{ reason: string, details?: string }} body
 */
export const disputeTask = (id, body) =>
  api.post(`/tasks/${id}/dispute`, body);
