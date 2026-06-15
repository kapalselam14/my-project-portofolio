import { useForm } from 'react-hook-form';  
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { isValidUniEmail } from '../../context/appConstants';

import SignupModal from './SignupModal';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function LoginForm() {
    const navigate = useNavigate();
    const { login } = useApp();
    const [showPass, setshowPass] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [showSignup, setShowSignup] = useState(false);
    const [showForgot, setShowForgot] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        clearErrors,
    } = useForm();

    const onSubmit = async (data) => {
        setLoginError('');
        // Validate email format before sending login request
        if (!isValidUniEmail(data.email)) {
            setError('email', {
                type: 'manual',
                message: 'Must be a UoA email (@auckland.ac.nz or @aucklanduni.ac.nz)',
            });
            return;
        }
        const result = await login(data.email, data.password);
        if (result.success) {
            // handleLogin already saved user to AppContext and localStorage
            const roles = result.user?.roles || [];
            const isAdmin = roles.includes('ADMIN') || roles.includes('admin') || result.user?.role === 'admin';
            navigate(isAdmin ? '/admin' : '/dashboard');
        } else {
            setLoginError(result.error || 'Login failed');
        }
    };

    return (
        <>
            <div style={{ width: '100%' }}>
                <div className="welcome-header">
                    <div className="welcome-title">WELCOME</div>
                    <div className="welcome-subtitle">LOGIN</div>
                </div>

                <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    {/* TODO: add username to be another login option */}
                    <div className="field-group">
                        <label className="field-label" htmlFor="login-email">University Email</label>
                        <input
                            id="login-email"
                            type="email"
                            className={`gf-input${errors.email ? ' error' : ''}`}
                            placeholder="username@auckland.ac.nz"
                            autoComplete="email"
                            {...register('email', { required: 'Email is required.' })}
                            onFocus={() => { clearErrors('email'); setLoginError(''); }}
                        />
                        {errors.email && <span className="login-error">{errors.email.message}</span>}
                    </div>

                    <div className="field-group">
                        <label className="field-label" htmlFor="login-password">Password</label>
                        <div className="input-wrapper">
                            <input
                                id="login-password"
                                type={showPass ? 'text' : 'password'}
                                className={`gf-input${errors.password ? ' error' : ''}`}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                {...register('password', { required: 'Password is required.' })}
                                onFocus={() => { clearErrors('password'); setLoginError(''); }}
                            />
                            <button
                                type="button"
                                className="input-eye-btn"
                                onClick={() => setshowPass((v) => !v)}
                                aria-label={showPass ? 'Hide password' : 'Show password'}
                            >
                                {showPass ? '🙈' : '🙉'}
                            </button>
                        </div>
                        {errors.password && <span className="login-error">{errors.password.message}</span>}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <button
                            type="button"
                            className="forgot-link"
                            onClick={() => setShowForgot(true)}
                        >
                            Forgot password?
                        </button>
                    </div>

                    {loginError && <div className="login-error" style={{ textAlign: 'center' }}>{loginError}</div>}

                    <button type="submit" id="login-btn" className="login-btn">
                        LOGIN
                    </button>
                </form>

                <div className="landing-signup-row" style={{ marginTop: 20 }}>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => setShowSignup(true)}>Sign Up</button>
                </div>
            </div>
            
            {/* Modals */}
            {showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </>
    );
}