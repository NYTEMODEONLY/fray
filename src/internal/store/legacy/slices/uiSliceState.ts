import type { AppState, AppStateGet, AppStateSet } from "../shared";
import { createNotification } from "../shared";

export type UiSliceState = Pick<
  AppState,
  | "showMembers"
  | "showServerSettings"
  | "serverSettingsTab"
  | "searchQuery"
  | "isOnline"
  | "notifications"
  | "toggleMembers"
  | "openServerSettings"
  | "closeServerSettings"
  | "setServerSettingsTab"
  | "setSearchQuery"
  | "setOnline"
  | "dismissNotification"
  | "pushNotification"
>;

export const createUiSliceState = (
  set: AppStateSet,
  _get: AppStateGet
): UiSliceState => ({
  showMembers: true,
  showServerSettings: false,
  serverSettingsTab: "overview",
  searchQuery: "",
  isOnline: true,
  notifications: [],
  toggleMembers: () => set((state) => ({ showMembers: !state.showMembers })),
  openServerSettings: (tab = "overview") =>
    set({ showServerSettings: true, serverSettingsTab: tab }),
  closeServerSettings: () => set({ showServerSettings: false }),
  setServerSettingsTab: (tab) => set({ serverSettingsTab: tab }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setOnline: (value) => set({ isOnline: value }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
  pushNotification: (title, body, options) =>
    set((state) => ({
      notifications: [createNotification(title, body, options), ...state.notifications]
    }))
});
