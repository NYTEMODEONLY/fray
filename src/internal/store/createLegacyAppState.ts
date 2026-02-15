import type { AppStateCreator } from "./legacy/shared";
import { createAdminSliceState } from "./legacy/slices/adminSliceState";
import { createCallsSliceState } from "./legacy/slices/callsSliceState";
import { createMessagesSliceState } from "./legacy/slices/messagesSliceState";
import { createRoomsSliceState } from "./legacy/slices/roomsSliceState";
import { createSessionSliceState } from "./legacy/slices/sessionSliceState";
import { createSettingsSliceState } from "./legacy/slices/settingsSliceState";
import { createUiSliceState } from "./legacy/slices/uiSliceState";

export const createLegacyAppState: AppStateCreator = (set, get) => ({
  ...createSessionSliceState(set, get),
  ...createRoomsSliceState(set, get),
  ...createMessagesSliceState(set, get),
  ...createUiSliceState(set, get),
  ...createSettingsSliceState(set, get),
  ...createCallsSliceState(set, get),
  ...createAdminSliceState(set, get)
});

export type { AppState, AppStateCreator, ServerSettingsTab } from "./legacy/shared";
