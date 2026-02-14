import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const callsSliceKeys = [
  "callState",
  "joinCall",
  "leaveCall",
  "toggleMic",
  "toggleVideo",
  "toggleScreenShare"
] as const satisfies readonly (keyof AppState)[];

export type CallsSlice = Pick<AppState, (typeof callsSliceKeys)[number]>;

export const createCallsSlice = (legacyState: AppState): CallsSlice =>
  pickState(legacyState, callsSliceKeys);
