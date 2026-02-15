import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const adminSliceKeys = [
  "serverSettingsBySpaceId",
  "permissionOverridesBySpaceId",
  "moderationAuditBySpaceId",
  "saveServerSettings",
  "setCategoryPermissionRule",
  "setRoomPermissionRule"
] as const satisfies readonly (keyof AppState)[];

export type AdminSlice = Pick<AppState, (typeof adminSliceKeys)[number]>;

export const createAdminSlice = (legacyState: AppState): AdminSlice =>
  pickState(legacyState, adminSliceKeys);
