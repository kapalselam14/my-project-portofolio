import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import MiniModal from './MiniModal';

export default function ChangeUsernameModal({ onClose }) {
  const { currentUser, updateUsername } = useApp();
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    const res = await updateUsername(newUsername.trim());
    if (res.success) setSuccess(true);
    else setError(res.error);
  }

  return (
    <MiniModal title="Change Username" onClose={onClose}>
      {success ? (
        <div className="msg-success" style={{ marginTop: 12 }}>Username updated successfully!</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div className="field-group">
            <label className="field-label">Current Username</label>
            <div className="gf-input" style={{ background: 'var(--accent-light)', color: 'var(--text-muted)', cursor: 'default' }}>
              {currentUser?.username || currentUser?.name}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="new-username">New Username</label>
            <input
              id="new-username"
              type="text"
              className={`gf-input${error ? ' error' : ''}`}
              placeholder="At least 3 characters"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setError(''); }}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="gf-btn gf-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" id="save-username-btn" className="gf-btn gf-btn-primary" style={{ flex: 1 }}>Save</button>
          </div>
        </form>
      )}
    </MiniModal>
  );
}