import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import ChangePasswordModal from './settingspanel/ChangePasswordModal';
import ChangeUsernameModal from './settingspanel/ChangeUsernameModal';


const SETTINGS = [
    { id: 'username', icon: '👤', label: 'Change Username', desc: 'Update your display name' },
    { id: 'password', icon: '🔒', label: 'Change Password', desc: 'Update your password' },
];

export default function SettingsPanel({ onClose }) {
    const { darkMode, toggleDarkMode } = useApp();
    const [activeModal, setActiveModal] = useState(null);

    return (
        <AnimatePresence>
            <div className="settings-panel-wrapper" key="settings-panel">
                {/* Backdrop */}
                <motion.div
                    className="settings-panel-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />

                {/* Panel */}
                <motion.div
                    className="settings-panel"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
                >
                    <div className="settings-header">
                        <span style={{ fontSize: 22 }}>⚙️</span>
                        <span className="settings-title">Settings</span>
                        <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>
                    </div>

                    <div className="settings-list">
                        {SETTINGS.map((s) => (
                            <div
                                key={s.id}
                                id={`settings-${s.id}`}
                                className="settings-item"
                                onClick={() => setActiveModal(s.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setActiveModal(s.id)}
                            >
                                <div className="settings-item-left">
                                    <span className="settings-item-label">{s.icon} {s.label}</span>
                                    <span className="settings-item-desc">{s.desc}</span>
                                </div>
                                <span className="settings-item-arrow">›</span>
                            </div>
                        ))}

                        {/* Dark Mode Toggle */}
                        <div className="settings-item" style={{ cursor: 'default' }}>
                            <div className="settings-item-left">
                                <span className="settings-item-label">🌙 Dark Mode</span>
                                <span className="settings-item-desc">{darkMode ? 'Currently dark' : 'Currently light'}</span>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="dark-mode-toggle"
                                    checked={darkMode}
                                    onChange={toggleDarkMode}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Mini modals */}
            {activeModal === 'username' && (
                <ChangeUsernameModal key="modal-username" onClose={() => setActiveModal(null)} />
            )}
            {activeModal === 'password' && (
                <ChangePasswordModal key="modal-password" onClose={() => setActiveModal(null)} />
            )}
        </AnimatePresence>
    );
}
