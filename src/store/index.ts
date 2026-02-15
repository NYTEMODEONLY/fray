import { create } from "zustand";
import { createLegacyAppState, type AppState } from "../internal/store/createLegacyAppState";
import { createAdminSlice } from "./slices/adminSlice";
import { createCallsSlice } from "./slices/callsSlice";
import { createMessagesSlice } from "./slices/messagesSlice";
import { createRoomsSlice } from "./slices/roomsSlice";
import { createSessionSlice } from "./slices/sessionSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createUiSlice } from "./slices/uiSlice";

export const useAppStore = create<AppState>((set, get) => {
  const legacyState = createLegacyAppState(set, get);
  return {
    ...createSessionSlice(legacyState),
    ...createRoomsSlice(legacyState),
    ...createMessagesSlice(legacyState),
    ...createUiSlice(legacyState),
    ...createSettingsSlice(legacyState),
    ...createCallsSlice(legacyState),
    ...createAdminSlice(legacyState)
  };
});

export type { AppState, ServerSettingsTab } from "../internal/store/createLegacyAppState";
