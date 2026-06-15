import { createContext, useContext, useState } from 'react';
import axios from 'axios';
import { login, logout, register, getCurrentUser } from '../utils/authApi';
import {
  updateProfile,
  updatePassword as updatePasswordApi,
  identifyUserForReset,
  resetPasswordWithSecurityAnswer
} from '../utils/userApi';
import {
  SECURITY_QUESTIONS,
  isValidUniEmail,
} from './appConstants';

const AppContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const SECURITY_QUESTION_CODES = ['MOTHER_NAME', 'FAV_SPOT', 'PET_NAME'];
const AVATAR_KEY_PREFIX = 'gf_avatar_';

function getStoredAvatar(email) {
  if (!email) return null;
  return localStorage.getItem(`${AVATAR_KEY_PREFIX}${String(email).toLowerCase()}`);
}

function setStoredAvatar(email, dataUrl) {
  if (!email || !dataUrl) return null;
  const key = `${AVATAR_KEY_PREFIX}${String(email).toLowerCase()}`;
  localStorage.setItem(key, dataUrl);
  return dataUrl;
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('gf_current_user');
      if (!saved) return null;
      const user = JSON.parse(saved);
      const avatar = getStoredAvatar(user?.email);
      return avatar ? { ...user, avatar } : user;
    } catch {
      return null;
    }
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('gf_dark_mode') === 'true';
  });

  if (darkMode) document.documentElement.classList.add('dark-mode');
  else document.documentElement.classList.remove('dark-mode');

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('gf_dark_mode', next);
    if (next) document.documentElement.classList.add('dark-mode');
    else document.documentElement.classList.remove('dark-mode');
  }

  async function handleLogin(email, password) {
    try {
      const res = await login(email, password);
      const user = res.data?.user || res.user;

      let profileData = null;
      try {
        const profileRes = await getCurrentUser();
        profileData = profileRes?.data || null;
      } catch {
        profileData = null;
      }

      if (user) {
        const storedAvatar = getStoredAvatar(user.email);
        const mappedUser = {
          ...user,
          username: user.name,
          petName: profileData?.petName ?? user.petName,
          coins: profileData?.coins ?? user.coins,
          avatar: user.avatar || storedAvatar
        };
        setCurrentUser(mappedUser);
        localStorage.setItem('gf_current_user', JSON.stringify(mappedUser));
        return { success: true, user: mappedUser };
      }
      return { success: false, error: res.error || 'Login failed' };
    } catch (err) {
      return { success: false, error: err?.message || 'Login failed' };
    }
  }

  async function handleLogout() {
    await logout(setCurrentUser);
    localStorage.removeItem('gf_current_user');
    localStorage.removeItem('token');
  }

  async function handleRegister(formData) {
    if (!isValidUniEmail(formData.email)) {
      return { success: false, error: 'Email must be a valid University of Auckland address.' };
    }

    const securityQuestionCode =
      SECURITY_QUESTION_CODES[Number(formData.securityQuestion)] || 'PET_NAME';

    const payload = {
      name: formData.username,
      email: formData.email,
      password: formData.password,
      securityQuestionCode,
      securityAnswer: formData.securityAnswer,
    };

    try {
      const res = await register(payload);
      const user = res.data?.user || res.user;

      if (user) {
        let avatar = null;
        if (formData.avatar) {
          avatar = setStoredAvatar(user.email, formData.avatar);
        } else {
          avatar = user.avatar || getStoredAvatar(user.email);
        }
        const mappedUser = { ...user, username: user.name, avatar };
        setCurrentUser(mappedUser);
        localStorage.setItem('gf_current_user', JSON.stringify(mappedUser));
        return { success: true, user: mappedUser };
      }
      return { success: false, error: res.error || 'Registration failed' };
    } catch (err) {
      return { success: false, error: err?.message || 'Registration failed' };
    }
  }

  async function findUserForReset(identifier) {
    try {
      const res = await identifyUserForReset(identifier);
      return {
        success: true,
        user: {
          id: res.data?.userId || res.userId,
          email: res.data.email,
          securityQuestion: res.data.securityQuestionLabel
        }
      };
    } catch (err) {
      return { success: false, error: err?.message || 'No such user found.' };
    }
  }

  async function resetPassword(userId, email, securityAnswer, newPassword) {
    try {
      await resetPasswordWithSecurityAnswer({ userId, email, securityAnswer, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to reset password.' };
    }
  }

  async function updateUsername(newUsername) {
    try {
      const res = await updateProfile({ username: newUsername });
      const updated = res.data?.user;
      const updatedUser = {
        ...(currentUser || {}),
        username: updated?.name || newUsername,
        name: updated?.name || newUsername
      };
      setCurrentUser(updatedUser);
      localStorage.setItem('gf_current_user', JSON.stringify(updatedUser));
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to update username.' };
    }
  }

  async function updatePassword(currentPassword, newPassword) {
    try {
      await updatePasswordApi({ currentPassword, newPassword });
      return { success: true };
    } catch (err) {
      if (err.status === 401 && /password/i.test(err.message)) {
        return { success: false, error: 'Current password is incorrect.' };
      }
      if (err.status === 401) {
        return { success: false, error: 'Session expired. Please log in again.' };
      }
      return { success: false, error: err?.message || 'Failed to update password.' };
    }
  }

  async function refreshCoins() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/coins/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res?.data?.success) {
        setCurrentUser((prev) => {
          const updated = prev ? { ...prev, coins: res.data.data.coins } : prev;
          if (updated) localStorage.setItem('gf_current_user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch {
      // ignore refresh errors
    }
  }

  async function updateAvatar(avatarDataUrl) {
    try {
      await updateProfile({ avatar: avatarDataUrl });
      const email = currentUser?.email;
      if (email && avatarDataUrl) {
        setStoredAvatar(email, avatarDataUrl);
      }
      const updatedUser = { ...(currentUser || {}), avatar: avatarDataUrl };
      setCurrentUser(updatedUser);
      localStorage.setItem('gf_current_user', JSON.stringify(updatedUser));
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to update avatar.' };
    }
  }

  function updateCoins(newBalance) {
    const updatedUser = { ...(currentUser || {}), coins: newBalance };
    setCurrentUser(updatedUser);
    localStorage.setItem('gf_current_user', JSON.stringify(updatedUser));
  }

  const value = {
    currentUser,
    darkMode,
    toggleDarkMode,
    login: handleLogin,
    logout: handleLogout,
    register: handleRegister,
    findUserForReset,
    resetPassword,
    updateUsername,
    updatePassword,
    updateAvatar,
    updateCoins,
    refreshCoins,
    SECURITY_QUESTIONS,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}