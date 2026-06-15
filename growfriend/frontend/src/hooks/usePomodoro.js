import { useState, useEffect } from 'react';
import { startFocusSession, completeFocusSession, getActiveFocusSession } from '../utils/pomodoroApi';

// --- usePomodoro Hook: manages pomodoro logic e.g., timer state, mode cycling, pet position ---

export const MODES = {
    focus: { label: 'FOCUS', duration: 25 * 60, short: 25 },
    short: { label: 'SHORT BREAK', duration: 5 * 60, short: 5 },
    long: { label: 'LONG BREAK', duration: 15 * 60, short: 15 },
};

export default function usePomodoro({ onFocusReward } = {}) {
    const [mode, setMode] = useState('focus');
    const [timeLeft, setTimeLeft] = useState(MODES.focus.duration);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [wasInterrupted, setWasInterrupted] = useState(false);
    const [focusCount, setFocusCount] = useState(0);
    const [showBubble, setShowBubble] = useState(false);
    const [nextModeQueued, setNextModeQueued] = useState(null);
    const [focusSessionId, setFocusSessionId] = useState(null);
    const [focusMessage, setFocusMessage] = useState(null);
    const [showPauseWarning, setShowPauseWarning] = useState(false);
    const [showModeResetConfirm, setShowModeResetConfirm] = useState(false);
    const [pendingMode, setPendingMode] = useState(null);

    const totalDuration = MODES[mode].duration;
    const elapsed = totalDuration - timeLeft;
    const petProgress = elapsed / totalDuration;

    function extractSessionId(payload) {
        return (
            payload?.data?.session?.id ||
            payload?.data?.session?._id ||
            payload?.session?.id ||
            payload?.session?._id ||
            payload?.data?.id ||
            payload?.data?._id ||
            payload?.id ||
            payload?._id
        );
    }

    function getNextMode(currentMode, currentFocusCount) {
        if (currentMode === 'focus') {
            const newCount = currentFocusCount + 1;
            if (newCount >= 4) return { nextMode: 'long', newFocusCount: 0 };
            return { nextMode: 'short', newFocusCount: newCount };
        }
        return { nextMode: 'focus', newFocusCount: currentFocusCount };
    }

    useEffect(() => {
        if (!isRunning) return;
        const id = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    clearInterval(id);
                    setIsRunning(false);

                    if (mode === 'focus' && focusSessionId) {
                        const completeCall = wasInterrupted
                            ? completeFocusSession(focusSessionId, { cancelled: true })
                            : completeFocusSession(focusSessionId);

                        completeCall
                            .then((res) => {
                                const coins = res?.coins || res?.data?.coins;
                                if (wasInterrupted) {
                                    setFocusMessage({ type: 'info', text: 'Session was interrupted. No reward issued.' });
                                } else {
                                    setFocusMessage({ type: 'success', text: 'Focus completed! Reward issued.' });
                                    onFocusReward && onFocusReward(coins);
                                }
                            })
                            .catch(() => {
                                setFocusMessage({ type: 'error', text: 'Failed to report focus completion.' });
                            })
                            .finally(() => {
                                setFocusSessionId(null);
                                setWasInterrupted(false);
                                setIsPaused(false);
                            });
                    }

                    const { nextMode } = getNextMode(mode, mode === 'focus' ? focusCount : focusCount);
                    if (mode === 'focus') setFocusCount((c) => c + 1);
                    setNextModeQueued({ nextMode, newFocusCount: mode === 'focus' ? focusCount + 1 : focusCount });
                    setShowBubble(true);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRunning, mode, focusCount, focusSessionId, onFocusReward, wasInterrupted]);

    async function start() {
        if (mode === 'focus' && !focusSessionId) {
            try {
                try {
                    const active = await getActiveFocusSession();
                    const activeId = extractSessionId(active?.data || active);
                    if (activeId) {
                        setFocusSessionId(activeId);
                        setFocusMessage(null);
                        setWasInterrupted(false);
                        setIsPaused(false);
                        setIsRunning(true);
                        return;
                    }
                } catch (activeErr) {
                    const activeStatus = activeErr?.response?.status;
                    if (activeStatus && activeStatus !== 404) {
                        throw activeErr;
                    }
                }

                const res = await startFocusSession(MODES.focus.duration);
                const sessionId = extractSessionId(res);
                if (!sessionId) throw new Error('Missing session id');
                setFocusSessionId(sessionId);
                setFocusMessage(null);
            } catch (err) {
                const status = err?.response?.status;
                const activeId = extractSessionId(err?.response?.data?.errors?.activeSession);

                if (status === 409 && activeId) {
                    setFocusSessionId(activeId);
                    setFocusMessage(null);
                } else if (status === 409) {
                    try {
                        const active = await getActiveFocusSession();
                        const sessionId = extractSessionId(active?.data || active);
                        if (sessionId) {
                            setFocusSessionId(sessionId);
                            setFocusMessage(null);
                        } else {
                            setFocusMessage({ type: 'error', text: 'Failed to start focus session.' });
                            return;
                        }
                    } catch {
                        setFocusMessage({ type: 'error', text: 'Failed to start focus session.' });
                        return;
                    }
                } else {
                    setFocusMessage({ type: 'error', text: 'Failed to start focus session.' });
                    return;
                }
            }
        }
        setWasInterrupted(false);
        setIsPaused(false);
        setIsRunning(true);
    }

    function requestPause() {
        if (mode !== 'focus') {
            pause();
            return;
        }
        setShowPauseWarning(true);
    }

    function cancelPauseWarning() {
        setShowPauseWarning(false);
    }

    function confirmPause() {
        setShowPauseWarning(false);
        pause();
    }

    async function pause() {
        setIsRunning(false);
        setIsPaused(true);
        if (mode === 'focus') {
            setWasInterrupted(true);
            setFocusMessage({ type: 'info', text: 'Focus mode interrupted and you will not be rewarded.' });
        }
    }

    async function resume() {
        if (mode === 'focus' && !focusSessionId) {
            try {
                const res = await startFocusSession(MODES.focus.duration);
                const sessionId = extractSessionId(res);
                if (!sessionId) throw new Error('Missing session id');
                setFocusSessionId(sessionId);
                setFocusMessage(null);
            } catch {
                setFocusMessage({ type: 'error', text: 'Failed to resume focus session.' });
                return;
            }
        }
        setIsPaused(false);
        setIsRunning(true);
    }

    async function resetToMode(newMode) {
        setIsRunning(false);
        setIsPaused(false);
        setShowBubble(false);
        setNextModeQueued(null);

        if (mode === 'focus' && focusSessionId) {
            try {
                await completeFocusSession(focusSessionId, { cancelled: true });
            } catch {
                // ignore
            } finally {
                setFocusSessionId(null);
            }
        }

        setWasInterrupted(false);
        setFocusMessage(null);
        setMode(newMode);
        setTimeLeft(MODES[newMode].duration);
    }

    async function reset() {
        setIsRunning(false);
        setIsPaused(false);
        setShowBubble(false);
        setNextModeQueued(null);
        setTimeLeft(MODES[mode].duration);

        if (mode === 'focus' && focusSessionId) {
            try {
                await completeFocusSession(focusSessionId, { cancelled: true });
            } catch {
                // ignore
            } finally {
                setFocusSessionId(null);
                setWasInterrupted(false);
            }
        } else {
            setWasInterrupted(false);
        }
        setFocusMessage(null);
    }

    function requestSwitchMode(newMode) {
        if (isRunning && !wasInterrupted) {
            setPendingMode(newMode);
            setShowModeResetConfirm(true);
            return;
        }
        if (isPaused || wasInterrupted) {
            resetToMode(newMode);
            return;
        }
        switchMode(newMode);
    }

    function cancelModeReset() {
        setShowModeResetConfirm(false);
        setPendingMode(null);
    }

    function confirmModeReset() {
        const target = pendingMode || mode;
        setShowModeResetConfirm(false);
        setPendingMode(null);
        resetToMode(target);
    }

    function dismissBubble() {
        setShowBubble(false);
        if (nextModeQueued) {
            const { nextMode, newFocusCount } = nextModeQueued;
            const adjustedFocusCount = nextMode === 'long'
                ? 0
                : (nextMode === 'focus' ? (newFocusCount >= 4 ? 0 : newFocusCount) : newFocusCount);
            setMode(nextMode);
            setTimeLeft(MODES[nextMode].duration);
            setFocusCount(nextMode === 'long' ? 0 : adjustedFocusCount);
            setNextModeQueued(null);
        }
    }

    async function switchMode(newMode) {
        setIsRunning(false);
        setIsPaused(false);
        setShowBubble(false);

        if (mode === 'focus' && focusSessionId) {
            try {
                await completeFocusSession(focusSessionId, { cancelled: true });
            } catch {
                // ignore
            } finally {
                setFocusSessionId(null);
                setWasInterrupted(false);
            }
        }

        setFocusMessage(null);
        setMode(newMode);
        setTimeLeft(MODES[newMode].duration);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    const bubbleMessages = {
        focus: { title: "Focus Complete! 🎉", text: "Great work! Time for a break. Your buddy is proud of you!" },
        short: { title: "Break's Over! ⏰", text: "Ready to get back to it? Let's keep the momentum going!" },
        long: { title: "Long Break Done! 🌟", text: "Feeling refreshed? Time to dive back into a focus session!" },
    };

    return {
        mode,
        timeLeft,
        isRunning,
        isPaused,
        focusCount: mode === 'focus' ? focusCount : focusCount,
        petProgress,
        showBubble,
        bubbleMessage: bubbleMessages[mode],
        start,
        pause,
        resume,
        reset,
        dismissBubble,
        switchMode,
        formatTime,
        totalDuration,
        MODES,
        focusMessage,
        showPauseWarning,
        requestPause,
        confirmPause,
        cancelPauseWarning,
        requestSwitchMode,
        showModeResetConfirm,
        confirmModeReset,
        cancelModeReset,
        pendingMode,
    };
}