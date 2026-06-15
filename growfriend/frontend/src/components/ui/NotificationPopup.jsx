import { useEffect } from 'react';
import '../../styles/components/NotificationPopup.css';

function NotificationPopup({
  notifications = [],
  duration = 3200,
  onClose
}) {
  useEffect(() => {
    if (!notifications.length || !onClose) return undefined;
    const timers = notifications.map((item) => setTimeout(() => onClose(item.id), duration));
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [notifications, duration, onClose]);

  if (!notifications.length) return null;

  return (
    <div className="gf-notification-root" role="status" aria-live="polite">
      {notifications.map((item) => {
        const kind = ['success', 'error', 'info'].includes(item.type) ? item.type : 'info';
        return (
          <div key={item.id} className={`gf-notification gf-notification--${kind}`}>
            {item.message}
          </div>
        );
      })}
    </div>
  );
}

export default NotificationPopup;
