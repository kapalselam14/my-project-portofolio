import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import {
  SECURITY_QUESTIONS,
  isValidPassword,
  isValidUniEmail,
  isValidDob,
} from '../../context/appConstants';

export default function SignupModal({ onClose }) {
  const { register: registerUser } = useApp();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatar, setAvatar] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isValid },
  } = useForm({ mode: 'onChange' });

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatar(ev.target.result);
      setAvatarPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  const onSubmit = async (data) => {
    setServerError('');

    if (!isValidUniEmail(data.email)) {
      setError('email', {
        type: 'manual',
        message: 'Must be a UoA email (@auckland.ac.nz or @aucklanduni.ac.nz)'
      });
      return;
    }

    if (!isValidDob(data.dob)) {
      setError('dob', {
        type: 'manual',
        message: 'Must be MM-DD-YYYY format and a valid date.'
      });
      return;
    }

    if (!isValidPassword(data.password)) {
      setError('password', {
        type: 'manual',
        message: 'At least 8 chars, 1 uppercase, 1 lowercase, 1 number.'
      });
      return;
    }

    if (data.password !== data.confirmPassword) {
      setError('confirmPassword', {
        type: 'manual',
        message: 'Passwords do not match.'
      });
      return;
    }

    const result = await registerUser({
      email: data.email.trim(),
      username: data.username.trim(),
      dob: data.dob,
      password: data.password,
      securityQuestion: parseInt(data.securityQuestion, 10),
      securityAnswer: data.securityAnswer.trim(),
      avatar,
    });

    if (result.success) {
      setSuccess(true);
    } else {
      setServerError(result.error || 'Registration failed.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
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
          <h2 className="modal-title">SIGN UP</h2>

          {success ? (
            <div className="msg-success" style={{ textAlign: 'center', padding: '20px' }}>
              🎉 Account created successfully!<br />
              Please login with your new account.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-email">University Email *</label>
                <input
                  id="su-email"
                  type="email"
                  className={`gf-input${errors.email ? ' error' : ''}`}
                  placeholder="you@auckland.ac.nz"
                  {...register('email', { required: 'Email is required.' })}
                  onFocus={() => { clearErrors('email'); setServerError(''); }}
                />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </div>

              {/* Username */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-username">Username *</label>
                <input
                  id="su-username"
                  type="text"
                  className={`gf-input${errors.username ? ' error' : ''}`}
                  placeholder="At least 3 characters"
                  {...register('username', {
                    required: 'Username is required.',
                    minLength: { value: 3, message: 'Username must be at least 3 characters.' }
                  })}
                  onFocus={() => { clearErrors('username'); setServerError(''); }}
                />
                {errors.username && <span className="field-error">{errors.username.message}</span>}
              </div>

              {/* Date of Birth */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-dob">Date of Birth *</label>
                <input
                  id="su-dob"
                  type="text"
                  className={`gf-input${errors.dob ? ' error' : ''}`}
                  placeholder="MM-DD-YYYY"
                  maxLength={10}
                  {...register('dob', { required: 'Date of birth is required.' })}
                  onFocus={() => { clearErrors('dob'); setServerError(''); }}
                />
                {errors.dob && <span className="field-error">{errors.dob.message}</span>}
              </div>

              {/* Password */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-password">Password *</label>
                <input
                  id="su-password"
                  type="password"
                  className={`gf-input${errors.password ? ' error' : ''}`}
                  placeholder="Create a strong password"
                  {...register('password', { required: 'Password is required.' })}
                  onFocus={() => { clearErrors('password'); setServerError(''); }}
                />
                <span className="field-hint">
                  At least 8 characters, with 1 uppercase, 1 lowercase, and 1 number.
                </span>
                {errors.password && <span className="field-error">{errors.password.message}</span>}
              </div>

              {/* Confirm Password */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-confirm">Confirm Password *</label>
                <input
                  id="su-confirm"
                  type="password"
                  className={`gf-input${errors.confirmPassword ? ' error' : ''}`}
                  placeholder="Re-enter your password"
                  {...register('confirmPassword', { required: 'Please confirm your password.' })}
                  onFocus={() => { clearErrors('confirmPassword'); setServerError(''); }}
                />
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}
              </div>

              {/* Security Question */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-secq">Security Question *</label>
                <select
                  id="su-secq"
                  className={`gf-input${errors.securityQuestion ? ' error' : ''}`}
                  {...register('securityQuestion', { required: 'Please select a security question.' })}
                  onFocus={() => { clearErrors('securityQuestion'); setServerError(''); }}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">-- Select a question --</option>
                  {SECURITY_QUESTIONS.map((q, i) => (
                    <option key={i} value={i}>{q}</option>
                  ))}
                </select>
                {errors.securityQuestion && <span className="field-error">{errors.securityQuestion.message}</span>}
              </div>

              {/* Security Answer */}
              <div className="field-group">
                <label className="field-label" htmlFor="su-seca">Your Answer *</label>
                <input
                  id="su-seca"
                  type="text"
                  className={`gf-input${errors.securityAnswer ? ' error' : ''}`}
                  placeholder="Type your answer"
                  {...register('securityAnswer', { required: 'Security answer is required.' })}
                  onFocus={() => { clearErrors('securityAnswer'); setServerError(''); }}
                />
                {errors.securityAnswer && <span className="field-error">{errors.securityAnswer.message}</span>}
              </div>

              {/* Profile Picture */}
              <div className="field-group">
                <label className="field-label">Profile Picture (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={avatarPreview || '/profilemock.jpg'}
                    alt="Avatar preview"
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
                  />
                  <label htmlFor="su-avatar" className="gf-btn gf-btn-ghost" style={{ fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}>
                    Upload Photo
                    <input id="su-avatar" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                  </label>
                  <span className="field-hint" style={{ flex: 1 }}>Default avatar used if not uploaded</span>
                </div>
              </div>

              {serverError && <div className="msg-error">{serverError}</div>}

              <button
                type="submit"
                id="signup-submit-btn"
                className="gf-btn gf-btn-primary"
                disabled={!isValid}
                style={{ width: '100%', marginTop: 4, fontSize: '1rem', letterSpacing: 1.5 }}
              >
                Create Account
              </button>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}