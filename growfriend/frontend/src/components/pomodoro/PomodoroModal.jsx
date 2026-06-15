import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import usePomodoro from '../../hooks/usePomodoro';
import '../../styles/pomodoro.css';
import { useApp } from '../../context/AppContext';
import PetSprite from '../petAnimations/PetSprite';

const MotionDiv = motion.div;

function normalizeSpeciesKey(input) {
    if (!input) return 'apteryx';
    let key = String(input).trim().toLowerCase();
    if (key.match(/kiwi|apteryx/)) return 'apteryx';
    if (key.match(/penguin/)) return 'penguin';
    if (key.match(/lemur|lemuera/)) return 'lemuera';
    if (key.match(/pukeko/)) return 'pukeko';
    if (key.match(/pateke/)) return 'pateke';
    if (key.match(/pyro/)) return 'pyro';
    return 'apteryx';
}

export default function PomodoroModal({ onRequestClose, onRunningChange, onSessionComplete, activePet } = {}) {
    const { refreshCoins, updateCoins } = useApp();
    const onFocusRewardHandler = (coins) => {
        updateCoins(coins);
        refreshCoins();
    };
    const {
        mode, timeLeft, isRunning, isPaused, petProgress,
        showBubble, bubbleMessage, start, pause, resume, reset, dismissBubble,
        switchMode, formatTime, MODES: modes, focusMessage,
        showPauseWarning, requestPause, confirmPause, cancelPauseWarning,
        requestSwitchMode, showModeResetConfirm, confirmModeReset, cancelModeReset, pendingMode,
    } = usePomodoro({ onFocusReward: onFocusRewardHandler });

    const handleClose = async () => {
        if (isRunning) {
            await reset();
        }
        onRequestClose?.();
    };

    useEffect(() => {
        return () => {
            if (isRunning) reset();
        };
    }, []);

    useEffect(() => {
        onRunningChange?.(isRunning);
    }, [isRunning, onRunningChange]);

    // Notify parent when a focus session completes so pet can celebrate
    useEffect(() => {
        if (showBubble && mode === 'focus') {
            onSessionComplete?.();
        }
    }, [showBubble, mode, onSessionComplete]);

    const modeKeys = ['focus', 'short', 'long'];
    const modeLabels = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };
    const tabLabels = {
        focus: 'FOCUS',
        short: <>SHORT<br />BREAK</>,
        long: <>LONG<br />BREAK</>,
    };
    const modeText = {
        focus: 'Focus',
        short: 'Short Break',
        long: 'Long Break',
    };
    const petLeft = `calc(${petProgress * 100}% - ${petProgress * 60}px)`;

    const petSpecies = normalizeSpeciesKey(activePet?.speciesCode || activePet?.spriteKey || 'apteryx');
    const petStageRaw = activePet ? (activePet.stage || '').toUpperCase() : 'EGG';
    const petStage = petStageRaw === 'EGG' ? 'egg' : petStageRaw === 'KID' ? 'kid' : 'adult';
    const petAnimState = showBubble ? 'celebrating' : isRunning ? 'idle' : 'sleeping';

    return (
        <MotionDiv
            className="pomodoro-page"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
        >
            <div className={`pomo-modal mode-${mode}`} role="dialog" aria-modal="true" aria-label="Pomodoro timer">
                {/* Exit Button */}
                <button
                    id="pomo-exit-btn"
                    className="pomo-exit-btn"
                    onClick={handleClose}
                >
                    ← Exit
                </button>

                {/* Mode Tabs */}
                <div className="pomo-tabs" role="tablist">
                    {modeKeys.map((m) => (
                        <button
                            key={m}
                            id={`pomo-tab-${m}`}
                            className={`pomo-tab mode-${m}${mode === m ? ' active' : ''}`}
                            role="tab"
                            aria-selected={mode === m}
                            onClick={() => requestSwitchMode(m)}
                        >
                            {tabLabels[m]}
                        </button>
                    ))}
                </div>

                {/* Timer Display */}
                <div className="pomo-timer-wrapper">
                    <div id="pomo-time-display" className="pomo-time-display">
                        {formatTime(timeLeft)}
                    </div>

                    {/* Controls */}
                    <div className="pomo-controls">
                        {!isRunning && !isPaused && (
                            <button id="pomo-start-btn" className="pomo-start-btn" onClick={start}>
                                START
                            </button>
                        )}
                        {isRunning && (
                            <button id="pomo-pause-btn" className="pomo-pause-btn" onClick={requestPause}>
                                PAUSE
                            </button>
                        )}
                        {isPaused && (
                            <>
                                <button id="pomo-resume-btn" className="pomo-pause-btn" onClick={resume}>
                                    RESUME
                                </button>
                                <button id="pomo-reset-btn" className="pomo-pause-btn" onClick={reset}>
                                    RESET
                                </button>
                            </>
                        )}
                    </div>

                    {/* Mode info */}
                    <div className="pomo-mode-info">
                        {mode === 'focus' && `Focus session · ${modes.focus.short} minutes`}
                        {mode === 'short' && `Short break · ${modes.short.short} minutes`}
                        {mode === 'long' && `Long break · ${modes.long.short} minutes`}
                    </div>
                    {focusMessage && (
                        <div className={`pomo-status-message ${focusMessage.type || 'info'}`}>
                            {focusMessage.text}
                        </div>
                    )}
                </div>

                {/* Progress Track + Pet */}
                <div className="pomo-progress-section">
                    <div className="pomo-track-wrapper">
                        <div className="pomo-pet" style={{ left: petLeft, width: 80, height: 80 }}>
                            <PetSprite
                                species={petSpecies}
                                stage={petStage}
                                animState={petAnimState}
                                size={80}
                                showShadow={false}
                            />
                        </div>
                        <div className="pomo-track">
                            <div
                                className="pomo-track-fill"
                                style={{ width: `${petProgress * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Pet Notification Bubble */}
            <AnimatePresence>
                {showBubble && (
                    <MotionDiv
                        className="pomo-bubble-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={dismissBubble}
                    >
                        <MotionDiv
                            className="pomo-bubble"
                            initial={{ scale: 0.8, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="pomo-bubble-pet-wrapper" style={{ width: 60, height: 60, margin: '0 auto 10px' }}>
                                <PetSprite
                                    species={petSpecies}
                                    stage={petStage}
                                    animState="celebrating"
                                    size={60}
                                    showShadow={false}
                                />
                            </div>
                            <div className="pomo-bubble-title">{bubbleMessage.title}</div>
                            <div className="pomo-bubble-text">{bubbleMessage.text}</div>
                            <div className="pomo-bubble-hint">Click anywhere to continue</div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Pause Warning Popup */}
            <AnimatePresence>
                {showPauseWarning && (
                    <MotionDiv
                        className="pomo-bubble-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={cancelPauseWarning}
                    >
                        <MotionDiv
                            className="pomo-bubble"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="pomo-bubble-title">Pause Warning</div>
                            <div className="pomo-bubble-text">
                                If you pause, you will <b>not</b> receive a reward even if you resume.
                            </div>
                            <div className="pomo-confirm-buttons">
                                <button className="pomo-pause-btn" onClick={confirmPause}>Pause Anyway</button>
                                <button className="pomo-start-btn" onClick={cancelPauseWarning}>Keep Going</button>
                            </div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Reset Confirm Popup */}
            <AnimatePresence>
                {showModeResetConfirm && (
                    <MotionDiv
                        className="pomo-bubble-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={cancelModeReset}
                    >
                        <MotionDiv
                            className="pomo-bubble"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="pomo-bubble-title">Reset Timer?</div>
                            <div className="pomo-bubble-text">
                                You clicked {modeText[pendingMode || mode]}. Do you want to reset the current timer?
                            </div>
                            <div className="pomo-confirm-buttons">
                                <button className="pomo-pause-btn" onClick={confirmModeReset}>Yes, Reset</button>
                                <button className="pomo-start-btn" onClick={cancelModeReset}>No, Continue</button>
                            </div>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </MotionDiv>
    );
}