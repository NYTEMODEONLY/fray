import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const uiSliceKeys = [
  "showMembers",
  "showServerSettings",
  "serverSettingsTab",
  "searchQuery",
  "isOnline",
  "notifications",
  "toggleMembers",
  "openServerSettings",
  "closeServerSettings",
  "setServerSettingsTab",
  "setSearchQuery",
  "setOnline",
  "dismissNotification",
  "pushNotification"
] as const satisfies readonly (keyof AppState)[];

export type UiSlice = Pick<AppState, (typeof uiSliceKeys)[number]>;

export const createUiSlice = (legacyState: AppState): UiSlice =>
  pickState(legacyState, uiSliceKeys);
