import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import '../styles/admin/index.css';
import AdminTaskList from '../components/admin/AdminTaskList';
import AdminDisputeList from '../components/admin/AdminDisputeList';

export default function AdminPage() {
    const [activeView, setActiveView] = useState('tasks');
    const { currentUser, logout, darkMode, toggleDarkMode } = useApp();
    const navigate = useNavigate();

    const isAdmin = currentUser && (
        (currentUser.roles || []).includes('ADMIN') ||
        (currentUser.roles || []).includes('admin') ||
        currentUser.role === 'admin'
    );

    useEffect(() => {
        if (!currentUser || !isAdmin) {
            navigate('/landingpage', { replace: true });
        }
    }, [currentUser, isAdmin, navigate]);

    function handleLogout() {
        logout();
        navigate('/landingpage');
    }

    if (!currentUser || !isAdmin) return null;

    return (
        <div className="admin-page">
            <aside className="admin-sidebar">
                <div>
                    <div className="admin-sidebar-logo">GROW FRIEND</div>
                    <div className="admin-sidebar-sub">Admin Panel</div>
                </div>

                <nav className="admin-nav">
                    <button
                        className={'admin-nav-btn' + (activeView === 'tasks' ? ' admin-nav-btn--active' : '')}
                        onClick={() => setActiveView('tasks')}
                    >
                        <span className="admin-nav-icon">📋</span>
                        <span className="admin-nav-label">Tasks</span>
                    </button>
                    <button
                        className={'admin-nav-btn' + (activeView === 'disputes' ? ' admin-nav-btn--active' : '')}
                        onClick={() => setActiveView('disputes')}
                    >
                        <span className="admin-nav-icon">⚖️</span>
                        <span className="admin-nav-label">Disputes</span>
                    </button>
                </nav>

                <div className="admin-sidebar-bottom">
                    <div className="admin-darkmode-row">
                        <span className="admin-darkmode-label">Dark Mode</span>
                        <label className="admin-toggle-switch">
                            <input
                                type="checkbox"
                                checked={darkMode}
                                onChange={toggleDarkMode}
                            />
                            <span className="admin-toggle-slider" />
                        </label>
                    </div>
                    <button className="admin-logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                {activeView === 'tasks' && <AdminTaskList />}
                {activeView === 'disputes' && <AdminDisputeList />}
            </main>
        </div>
    );
}
