import { useEffect, useRef } from "react";
import type { NotificationAction, NotificationItem } from "../types";
import { checkForDesktopUpdateAvailability } from "../services/appUpdateService";

interface NotificationEffectsOptions {
  notifications: NotificationItem[];
  notificationsEnabled: boolean;
  mentionsOnlyNotifications: boolean;
  meName: string;
  pushNotification: (
    title: string,
    body: string,
    options?: { action?: NotificationAction }
  ) => void;
  notifyDesktop: (title: string, body: string) => void;
}

export const useNotificationEffects = ({
  notifications,
  notificationsEnabled,
  mentionsOnlyNotifications,
  meName,
  pushNotification,
  notifyDesktop
}: NotificationEffectsOptions) => {
  const lastNotificationCount = useRef(0);
  const updateNoticeCheckedRef = useRef(false);

  useEffect(() => {
    if (!notificationsEnabled) {
      lastNotificationCount.current = notifications.length;
      return;
    }
    if (notifications.length > lastNotificationCount.current) {
      const newest = notifications[0];
      if (newest) {
        const shouldNotify =
          !mentionsOnlyNotifications ||
          newest.title.toLowerCase().includes("mention") ||
          newest.body.toLowerCase().includes(`@${meName.toLowerCase()}`);
        if (!shouldNotify) {
          lastNotificationCount.current = notifications.length;
          return;
        }
        notifyDesktop(newest.title, newest.body);
      }
    }
    lastNotificationCount.current = notifications.length;
  }, [mentionsOnlyNotifications, meName, notifications, notificationsEnabled, notifyDesktop]);

  useEffect(() => {
    if (updateNoticeCheckedRef.current) return;
    updateNoticeCheckedRef.current = true;
    void checkForDesktopUpdateAvailability().then((availableUpdate) => {
      if (!availableUpdate) return;
      pushNotification(
        "Update available",
        `Fray ${availableUpdate.version} is available.`,
        { action: { id: "install-update", label: "Update now" } }
      );
    });
  }, [pushNotification]);
};
