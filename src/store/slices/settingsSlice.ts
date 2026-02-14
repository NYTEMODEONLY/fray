import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const settingsSliceKeys = [
  "composerEnterToSend",
  "messageDensity",
  "notificationsEnabled",
  "mentionsOnlyNotifications",
  "keybindsEnabled",
  "composerSpellcheck",
  "reducedMotion",
  "highContrast",
  "fontScale",
  "theme",
  "onboardingStep",
  "profileDisplayName",
  "profileAbout",
  "profileAvatarDataUrl",
  "setComposerEnterToSend",
  "setMessageDensity",
  "setNotificationsEnabled",
  "setMentionsOnlyNotifications",
  "setKeybindsEnabled",
  "setComposerSpellcheck",
  "setReducedMotion",
  "setHighContrast",
  "setFontScale",
  "setTheme",
  "setProfileDisplayName",
  "setProfileAbout",
  "setProfileAvatarDataUrl",
  "completeOnboarding"
] as const satisfies readonly (keyof AppState)[];

export type SettingsSlice = Pick<AppState, (typeof settingsSliceKeys)[number]>;

export const createSettingsSlice = (legacyState: AppState): SettingsSlice =>
  pickState(legacyState, settingsSliceKeys);
