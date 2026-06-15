// Simple popup notification store for Notification.svelte usage
export const notificationPopup = writable({
  show: false,
  message: '',
  type: 'success',
  duration: 3000
});

export function showNotification({ message, type = 'success', duration = 3000 }) {
  notificationPopup.set({ show: true, message, type, duration });
  setTimeout(() => notificationPopup.set({ show: false, message: '', type, duration }), duration);
}
import { writable } from 'svelte/store';
import { auth } from './auth.js';

export const notifications = writable([]);
export const unreadCount = writable(0);


let eventSource = null;
let currentToken = null;
let reconnectTimeout = null;


function connect(token) {
  if (eventSource) eventSource.close();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (!token) return;
  currentToken = token;

  // Initial fetch
  fetch('/api/notifications', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(r => r.json())
    .then(data => {
      notifications.set(data.notifications || []);
      unreadCount.set(data.unreadCount || 0);
    });

  // SSE with token as query param
  const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
  eventSource = new EventSource(sseUrl);
  eventSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'init') {
        unreadCount.set(msg.unreadCount || 0);
      } else {
        // New notification event
        unreadCount.update(n => n + 1);
        notifications.update(list => [msg, ...list]);
      }
    } catch {}
  };
  eventSource.onerror = () => {
    eventSource.close();
    eventSource = null;
    // Try to reconnect after 2 seconds
    reconnectTimeout = setTimeout(() => {
      connect(token);
    }, 2000);
  };
}


function disconnect() {
  if (eventSource) eventSource.close();
  eventSource = null;
  currentToken = null;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

// Mark all notifications as read (example, needs backend endpoint)
export async function markAllAsRead(token) {
  if (!token) return;
  await fetch('/api/notifications/mark-all-read', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  unreadCount.set(0);
  notifications.update(list => list.map(n => ({ ...n, read: true })));
}

// React to auth changes
auth.subscribe((val) => {
  const token = val?.token;
  if (token && token !== currentToken) {
    connect(token);
  } else if (!token) {
    disconnect();
    notifications.set([]);
    unreadCount.set(0);
  }
});
