import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { isValidPassword } from '../../context/appConstants';

// ============================================================
//   Step 1: Verify username or email
//   Step 2: Answer security question + reset password
// ============================================================

export default function ForgotPasswordModal({ onClose }) {
  const { findUserForReset, resetPassword } = useApp();
  const [step, setStep] = useState(1);
  const [foundUser, setFoundUser] = useState(null);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register: register1,
    handleSubmit: handleSubmit1,
    setError: setError1,
    clearErrors: clearErrors1,
    formState: { errors: errors1 }
  } = useForm();

  const {
    register: register2,
    handleSubmit: handleSubmit2,
    setError: setError2,
    clearErrors: clearErrors2,
    formState: { errors: errors2 },
    watch
  } = useForm();

  const onStep1 = async ({ identifier }) => {
    setServerError('');
    const res = await findUserForReset(identifier.trim());
    if (res.success) {
      setFoundUser(res.user);
      setStep(2);
    } else {
      setError1('identifier', { type: 'manual', message: res.error || 'User not found' });
    }
  };

  const onStep2 = async (data) => {
    setServerError('');

    if (!isValidPassword(data.newPassword)) {
      setError2('newPassword', {
        type: 'manual',
        message: 'At least 8 chars, 1 uppercase, 1 lowercase, 1 number.'
      });
      return;
    }

    if (data.newPassword !== data.confirmPassword) {
      setError2('confirmPassword', {
        type: 'manual',
        message: 'Passwords do not match.'
      });
      return;
    }

    const res = await resetPassword(
      foundUser.id,
      foundUser.email,
      data.securityAnswer,
      data.newPassword
    );

    if (res.success) {
      setSuccess(true);
    } else {
      setServerError(res.error || 'Failed to reset password.');
      setError2('securityAnswer', { type: 'manual', message: 'Incorrect security answer.' });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="modal-box"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ maxWidth: 500 }}
        >
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
          <h2 className="modal-title">FORGOT PASSWORD</h2>

          {success ? (
            <div className="msg-success" style={{ textAlign: 'center', padding: '20px' }}>
              ✅ Password reset successfully.<br />
              Please login with your new password.
            </div>
          ) : (
            <>
              {step === 1 && (
                <form onSubmit={handleSubmit1(onStep1)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="fp-identifier">Email or Username</label>
                    <input
                      id="fp-identifier"
                      type="text"
                      className={`gf-input${errors1.identifier ? ' error' : ''}`}
                      placeholder="you@auckland.ac.nz or username"
                      {...register1('identifier', { required: 'Identifier is required.' })}
                      onFocus={() => { clearErrors1('identifier'); setServerError(''); }}
                    />
                    {errors1.identifier && <span className="field-error">{errors1.identifier.message}</span>}
                  </div>
                  <button type="submit" className="gf-btn gf-btn-primary">Next</button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleSubmit2(onStep2)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label">Security Question</label>
                    <div className="gf-input" style={{ background: 'var(--accent-light)', color: 'var(--text-muted)', cursor: 'default' }}>
                      {foundUser.securityQuestion}
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="fp-answer">Your Answer</label>
                    <input
                      id="fp-answer"
                      type="text"
                      className={`gf-input${errors2.securityAnswer ? ' error' : ''}`}
                      placeholder="Answer"
                      {...register2('securityAnswer', { required: 'Security answer is required.' })}
                      onFocus={() => { clearErrors2('securityAnswer'); setServerError(''); }}
                      onChange={() => { clearErrors2('securityAnswer'); setServerError(''); }}
                    />
                    {errors2.securityAnswer && <span className="field-error">{errors2.securityAnswer.message}</span>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="fp-new">New Password</label>
                    <input
                      id="fp-new"
                      type="password"
                      className={`gf-input${errors2.newPassword ? ' error' : ''}`}
                      placeholder="New password"
                      {...register2('newPassword', { required: 'New password is required.' })}
                      onFocus={() => { clearErrors2('newPassword'); setServerError(''); }}
                    />
                    {errors2.newPassword && <span className="field-error">{errors2.newPassword.message}</span>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="fp-confirm">Confirm Password</label>
                    <input
                      id="fp-confirm"
                      type="password"
                      className={`gf-input${errors2.confirmPassword ? ' error' : ''}`}
                      placeholder="Confirm password"
                      {...register2('confirmPassword', { required: 'Please confirm your password.' })}
                      onFocus={() => { clearErrors2('confirmPassword'); setServerError(''); }}
                    />
                    {errors2.confirmPassword && <span className="field-error">{errors2.confirmPassword.message}</span>}
                  </div>

                  {serverError && <div className="msg-error">{serverError}</div>}

                  <button type="submit" className="gf-btn gf-btn-primary">Reset Password</button>
                </form>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}