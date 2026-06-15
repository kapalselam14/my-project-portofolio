import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { isValidPassword } from '../../../context/appConstants';
import MiniModal from './MiniModal';

export default function ChangePasswordModal({ onClose }) {
  const { updatePassword } = useApp();
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  function setF(key, val) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.current) errs.current = 'Current password is required.';
    if (!form.newPw) errs.newPw = 'New password is required.';
    else if (!isValidPassword(form.newPw)) errs.newPw = 'At least 8 chars, 1 uppercase, 1 lowercase, 1 number.';
    if (!form.confirm) errs.confirm = 'Please confirm your new password.';
    else if (form.newPw !== form.confirm) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const res = await updatePassword(form.current, form.newPw);
    if (res.success) setSuccess(true);
    else setErrors({ current: res.error });
  }

  return (
    <MiniModal title="Change Password" onClose={onClose}>
      {success ? (
        <div className="msg-success" style={{ marginTop: 12 }}>Password changed successfully!</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div className="field-group">
            <label className="field-label" htmlFor="cp-current">Current Password</label>
            <input
              id="cp-current"
              type="password"
              className={`gf-input${errors.current ? ' error' : ''}`}
              placeholder="Your current password"
              value={form.current}
              onChange={(e) => setF('current', e.target.value)}
            />
            {errors.current && <span className="field-error">{errors.current}</span>}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="cp-new">New Password</label>
            <input
              id="cp-new"
              type="password"
              className={`gf-input${errors.newPw ? ' error' : ''}`}
              placeholder="Create new password"
              value={form.newPw}
              onChange={(e) => setF('newPw', e.target.value)}
            />
            <span className="field-hint">At least 8 chars, 1 uppercase, 1 lowercase, 1 number.</span>
            {errors.newPw && <span className="field-error">{errors.newPw}</span>}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="cp-confirm">Confirm New Password</label>
            <input
              id="cp-confirm"
              type="password"
              className={`gf-input${errors.confirm ? ' error' : ''}`}
              placeholder="Re-enter new password"
              value={form.confirm}
              onChange={(e) => setF('confirm', e.target.value)}
            />
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="gf-btn gf-btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" id="save-password-btn" className="gf-btn gf-btn-primary" style={{ flex: 1 }}>Save</button>
          </div>
        </form>
      )}
    </MiniModal>
  );
}