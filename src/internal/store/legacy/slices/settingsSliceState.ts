import type { AppState, AppStateGet, AppStateSet } from "../shared";
import {
  applyProfileToUser,
  applyProfileToUsers,
  loadedPreferences,
  savePreferences,
  toPreferencesFromState,
  trackLocalMetricEvent
} from "../shared";

export type SettingsSliceState = Pick<
  AppState,
  | "composerEnterToSend"
  | "messageDensity"
  | "notificationsEnabled"
  | "mentionsOnlyNotifications"
  | "keybindsEnabled"
  | "composerSpellcheck"
  | "reducedMotion"
  | "highContrast"
  | "fontScale"
  | "theme"
  | "onboardingStep"
  | "profileDisplayName"
  | "profileAbout"
  | "profileAvatarDataUrl"
  | "setComposerEnterToSend"
  | "setMessageDensity"
  | "setNotificationsEnabled"
  | "setMentionsOnlyNotifications"
  | "setKeybindsEnabled"
  | "setComposerSpellcheck"
  | "setReducedMotion"
  | "setHighContrast"
  | "setFontScale"
  | "setTheme"
  | "setProfileDisplayName"
  | "setProfileAbout"
  | "setProfileAvatarDataUrl"
  | "completeOnboarding"
>;

export const createSettingsSliceState = (
  set: AppStateSet,
  get: AppStateGet
): SettingsSliceState => ({
  composerEnterToSend: loadedPreferences.composerEnterToSend,
  messageDensity: loadedPreferences.messageDensity,
  notificationsEnabled: loadedPreferences.notificationsEnabled,
  mentionsOnlyNotifications: loadedPreferences.mentionsOnlyNotifications,
  keybindsEnabled: loadedPreferences.keybindsEnabled,
  composerSpellcheck: loadedPreferences.composerSpellcheck,
  reducedMotion: loadedPreferences.reducedMotion,
  highContrast: loadedPreferences.highContrast,
  fontScale: loadedPreferences.fontScale,
  theme: loadedPreferences.theme,
  onboardingStep: loadedPreferences.onboardingCompleted ? null : 0,
  profileDisplayName: loadedPreferences.profileDisplayName,
  profileAbout: loadedPreferences.profileAbout,
  profileAvatarDataUrl: loadedPreferences.profileAvatarDataUrl,
  setTheme: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), theme: value });
    trackLocalMetricEvent("settings_completion", { setting: "theme", value });
    set({ theme: value });
  },
  setComposerEnterToSend: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), composerEnterToSend: value });
    trackLocalMetricEvent("settings_completion", { setting: "composerEnterToSend", value });
    set({ composerEnterToSend: value });
  },
  setMessageDensity: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), messageDensity: value });
    trackLocalMetricEvent("settings_completion", { setting: "messageDensity", value });
    set({ messageDensity: value });
  },
  setNotificationsEnabled: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), notificationsEnabled: value });
    trackLocalMetricEvent("settings_completion", { setting: "notificationsEnabled", value });
    set({ notificationsEnabled: value });
  },
  setMentionsOnlyNotifications: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), mentionsOnlyNotifications: value });
    trackLocalMetricEvent("settings_completion", { setting: "mentionsOnlyNotifications", value });
    set({ mentionsOnlyNotifications: value });
  },
  setKeybindsEnabled: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), keybindsEnabled: value });
    trackLocalMetricEvent("settings_completion", { setting: "keybindsEnabled", value });
    set({ keybindsEnabled: value });
  },
  setComposerSpellcheck: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), composerSpellcheck: value });
    trackLocalMetricEvent("settings_completion", { setting: "composerSpellcheck", value });
    set({ composerSpellcheck: value });
  },
  setReducedMotion: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), reducedMotion: value });
    trackLocalMetricEvent("settings_completion", { setting: "reducedMotion", value });
    set({ reducedMotion: value });
  },
  setHighContrast: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), highContrast: value });
    trackLocalMetricEvent("settings_completion", { setting: "highContrast", value });
    set({ highContrast: value });
  },
  setFontScale: (value) => {
    savePreferences({ ...toPreferencesFromState(get()), fontScale: value });
    trackLocalMetricEvent("settings_completion", { setting: "fontScale", value });
    set({ fontScale: value });
  },
  setProfileDisplayName: (value) => {
    const trimmed = value.trim().slice(0, 32);
    const current = get();
    savePreferences({ ...toPreferencesFromState(current), profileDisplayName: trimmed });
    trackLocalMetricEvent("settings_completion", { setting: "profileDisplayName", value: Boolean(trimmed) });
    set((state) => {
      const nextMe = applyProfileToUser(state.me, trimmed, state.profileAvatarDataUrl);
      return {
        profileDisplayName: trimmed,
        me: nextMe,
        users: applyProfileToUsers(state.users, nextMe.id, trimmed, state.profileAvatarDataUrl)
      };
    });

    const client = get().matrixClient;
    if (client && trimmed) {
      client.setDisplayName(trimmed).catch((error) => {
        console.warn("Unable to sync display name to Matrix profile", error);
      });
    }
  },
  setProfileAbout: (value) => {
    const trimmed = value.trim().slice(0, 190);
    savePreferences({ ...toPreferencesFromState(get()), profileAbout: trimmed });
    trackLocalMetricEvent("settings_completion", { setting: "profileAbout", value: Boolean(trimmed) });
    set({ profileAbout: trimmed });
  },
  setProfileAvatarDataUrl: (value) => {
    const sanitized = typeof value === "string" && value.startsWith("data:image") ? value : null;
    const current = get();
    savePreferences({ ...toPreferencesFromState(current), profileAvatarDataUrl: sanitized });
    trackLocalMetricEvent("settings_completion", { setting: "profileAvatar", value: Boolean(sanitized) });
    set((state) => {
      const nextMe = applyProfileToUser(state.me, state.profileDisplayName, sanitized);
      return {
        profileAvatarDataUrl: sanitized,
        me: nextMe,
        users: applyProfileToUsers(state.users, nextMe.id, state.profileDisplayName, sanitized)
      };
    });

    const client = get().matrixClient;
    if (!client) return;

    if (!sanitized) {
      client.setAvatarUrl("").catch((error) => {
        console.warn("Unable to clear Matrix avatar", error);
      });
      return;
    }

    (async () => {
      try {
        const response = await fetch(sanitized);
        const blob = await response.blob();
        const upload = await client.uploadContent(blob as any);
        const contentUri =
          typeof upload === "string"
            ? upload
            : (upload as { content_uri?: string }).content_uri;
        if (!contentUri) return;
        await client.setAvatarUrl(contentUri);
      } catch (error) {
        console.warn("Unable to sync avatar to Matrix profile", error);
      }
    })();
  },
  completeOnboarding: () => {
    savePreferences({
      ...toPreferencesFromState(get()),
      onboardingCompleted: true
    });
    trackLocalMetricEvent("settings_completion", { setting: "onboardingCompleted", value: true });
    set({ onboardingStep: null });
  }
});
