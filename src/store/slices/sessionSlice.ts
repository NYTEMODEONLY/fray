import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const sessionSliceKeys = [
  "me",
  "users",
  "matrixClient",
  "matrixStatus",
  "matrixError",
  "matrixSession",
  "bootstrapMatrix",
  "login",
  "register",
  "logout"
] as const satisfies readonly (keyof AppState)[];

export type SessionSlice = Pick<AppState, (typeof sessionSliceKeys)[number]>;

export const createSessionSlice = (legacyState: AppState): SessionSlice =>
  pickState(legacyState, sessionSliceKeys);
