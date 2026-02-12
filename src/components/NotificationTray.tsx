import { NotificationItem } from "../types";
import type { NotificationActionId } from "../types";

interface NotificationTrayProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
  onAction: (id: string, actionId: NotificationActionId) => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const NotificationTray = ({ notifications, onDismiss, onAction }: NotificationTrayProps) => (
  <div className="notification-tray">
    {notifications.map((notification) => {
      const action = notification.action;
      return (
        <div key={notification.id} className="notification">
          <div>
            <p className="notification-title">{notification.title}</p>
            <p className="notification-body">{notification.body}</p>
            {action && (
              <button className="notification-action" onClick={() => onAction(notification.id, action.id)}>
                {action.label}
              </button>
            )}
            <span className="notification-time">{formatTime(notification.timestamp)}</span>
          </div>
          <button onClick={() => onDismiss(notification.id)}>Dismiss</button>
        </div>
      );
    })}
  </div>
);
