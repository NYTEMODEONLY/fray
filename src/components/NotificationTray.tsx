import { NotificationItem } from "../types";

interface NotificationTrayProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const NotificationTray = ({ notifications, onDismiss }: NotificationTrayProps) => (
  <div className="notification-tray">
    {notifications.map((notification) => (
      <div key={notification.id} className="notification">
        <div>
          <p className="notification-title">{notification.title}</p>
          <p className="notification-body">{notification.body}</p>
          <span className="notification-time">{formatTime(notification.timestamp)}</span>
        </div>
        <button onClick={() => onDismiss(notification.id)}>Dismiss</button>
      </div>
    ))}
  </div>
);
