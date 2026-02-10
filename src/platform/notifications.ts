export const notify = async (title: string, body: string) => {
  const tauriNotification = (window as unknown as {
    __TAURI__?: { notification?: { sendNotification: (payload: { title: string; body: string }) => void } };
  }).__TAURI__?.notification;

  if (tauriNotification?.sendNotification) {
    tauriNotification.sendNotification({ title, body });
    return;
  }

  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(title, { body });
      }
    }
  }
};
