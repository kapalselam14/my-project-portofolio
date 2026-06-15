import { useState, useEffect, useCallback } from 'react';
import CoinBadge from '../ui/CoinBadge';
import * as taskService from '../../services/taskService';
import { toFrontendList } from '../../utils/taskMapper';
import loadIconSmall from '../../assets/load-icon-small.png';

export default function AdminDisputeList() {
    const [disputes, setDisputes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [resolvedId, setResolvedId] = useState(null);
    const [isResolvingId, setIsResolvingId] = useState(null);
    const [resolveError, setResolveError] = useState(null);

    const fetchDisputes = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const res = await taskService.getTasks({ type: 'p2p', status: 'disputed' });
            setDisputes(toFrontendList(res.data.data.tasks));
        } catch {
            setFetchError('Failed to load disputes. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDisputes();
    }, [fetchDisputes]);

    async function handleResolve(taskId, favorOf) {
        setIsResolvingId(taskId);
        setResolveError(null);
        try {
            if (favorOf === 'creator') {
                await taskService.cancelTask(taskId);
            } else {
                await taskService.confirmTask(taskId);
            }
            setDisputes((prev) => prev.filter((t) => t.id !== taskId));
            setResolvedId(taskId);
            setConfirmAction(null);
            setTimeout(() => setResolvedId(null), 1200);
        } catch {
            setResolveError('Failed to resolve dispute. Please try again.');
            setConfirmAction(null);
        } finally {
            setIsResolvingId(null);
        }
    }

    if (isLoading) {
        return (
            <div className="admin-loading-state">
                <img src={loadIconSmall} alt="" className="admin-loading-icon" />
                <p className="admin-loading-text">Loading disputes...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="admin-error-state">
                <p className="admin-error-title">⚠️ {fetchError}</p>
                <button className="admin-error-retry" onClick={fetchDisputes}>Try Again</button>
            </div>
        );
    }

    return (
        <div>
            <h2 className="admin-page-title">Dispute Management</h2>
            <p className="admin-page-desc">
                Review and resolve disputes raised by players on P2P tasks.
            </p>

            {resolveError && (
                <div className="admin-error-banner">
                    <span>{resolveError}</span>
                    <button className="admin-error-banner-close" onClick={() => setResolveError(null)}>✕</button>
                </div>
            )}

            <p className="admin-dispute-count">{disputes.length} active disputes</p>

            {disputes.length === 0 ? (
                <div className="admin-empty-state">
                    <p className="admin-empty-title">No active disputes</p>
                    <p className="admin-empty-sub">All clear for now. No disputes have been raised by players.</p>
                </div>
            ) : (
                <div className="admin-dispute-table-wrap">
                <div className="admin-dispute-list">
                    <div className="admin-dispute-list-header">
                        <span className="admin-dispute-col admin-dispute-col--title">Task</span>
                        <span className="admin-dispute-col admin-dispute-col--reward">Reward</span>
                        <span className="admin-dispute-col admin-dispute-col--creator">Creator</span>
                        <span className="admin-dispute-col admin-dispute-col--assignee">Assignee</span>
                        <span className="admin-dispute-col admin-dispute-col--raised">Raised By</span>
                        <span className="admin-dispute-col admin-dispute-col--reason">Reason</span>
                        <span className="admin-dispute-col admin-dispute-col--actions">Actions</span>
                    </div>

                    {disputes.map((task) => (
                        <div className="admin-dispute-row" key={task.id}>
                            <span className="admin-dispute-col admin-dispute-col--title">
                                {task.title}
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--reward">
                                <CoinBadge amount={task.rewardCoins} />
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--creator">
                                {task.createdBy.name}
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--assignee">
                                {task.assignee?.name ?? 'Unknown'}
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--raised">
                                {task.disputeRaisedBy ? (
                                    <span className={`admin-dispute-raised-by admin-dispute-raised-by--${task.disputeRaisedBy}`}>
                                        {task.disputeRaisedBy === 'creator' ? 'Creator' : 'Assignee'}
                                    </span>
                                ) : (
                                    <span className="admin-dispute-raised-by admin-dispute-raised-by--unknown">Unknown</span>
                                )}
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--reason">
                                {task.disputeReason ?? <em className="admin-dispute-no-reason">No reason provided</em>}
                                {task.disputeDetails && (
                                    <span className="admin-dispute-reason-details"> — {task.disputeDetails}</span>
                                )}
                            </span>
                            <span className="admin-dispute-col admin-dispute-col--actions">
                                <button
                                    className="admin-dispute-btn admin-dispute-btn--creator"
                                    disabled={isResolvingId === task.id}
                                    onClick={() => setConfirmAction({ taskId: task.id, favorOf: 'creator' })}
                                >
                                    {isResolvingId === task.id ? '...' : 'Favor Creator'}
                                </button>
                                <button
                                    className="admin-dispute-btn admin-dispute-btn--assignee"
                                    disabled={isResolvingId === task.id}
                                    onClick={() => setConfirmAction({ taskId: task.id, favorOf: 'assignee' })}
                                >
                                    {isResolvingId === task.id ? '...' : 'Favor Assignee'}
                                </button>
                            </span>

                            {confirmAction !== null && confirmAction.taskId === task.id && (
                                <div className="admin-dispute-confirm-overlay">
                                    <p className="admin-dispute-confirm-text">
                                        {confirmAction.favorOf === 'creator'
                                            ? 'Favor Creator — task cancelled, coins returned.'
                                            : 'Favor Assignee — task completed, coins sent.'}
                                    </p>
                                    <div className="admin-dispute-confirm-actions">
                                        <button
                                            className="admin-dispute-confirm-btn admin-dispute-confirm-btn--yes"
                                            disabled={isResolvingId === task.id}
                                            onClick={() => handleResolve(task.id, confirmAction.favorOf)}
                                        >
                                            Yes, Resolve
                                        </button>
                                        <button
                                            className="admin-dispute-confirm-btn admin-dispute-confirm-btn--no"
                                            onClick={() => setConfirmAction(null)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {resolvedId === task.id && (
                                <div className="admin-dispute-resolved-toast">
                                    <span className="admin-dispute-resolved-icon">✓</span>
                                    <span className="admin-dispute-resolved-text">Resolved</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                </div>
            )}
        </div>
    );
}
