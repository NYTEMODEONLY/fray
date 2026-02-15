import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const roomsSliceKeys = [
  "spaces",
  "rooms",
  "currentSpaceId",
  "currentRoomId",
  "categoriesBySpaceId",
  "spaceLayoutsBySpaceId",
  "spaceStateHostRoomIdBySpaceId",
  "roomLastReadTsByRoomId",
  "threadLastViewedTsByRoomId",
  "historyLoadingByRoomId",
  "historyHasMoreByRoomId",
  "selectSpace",
  "selectRoom",
  "createRoom",
  "deleteRoom",
  "createSpace",
  "renameSpace",
  "createCategory",
  "renameCategory",
  "deleteCategory",
  "moveCategoryByStep",
  "reorderCategory",
  "moveRoomByStep",
  "moveRoomToCategory",
  "reorderRoom",
  "paginateCurrentRoomHistory",
  "markRoomRead"
] as const satisfies readonly (keyof AppState)[];

export type RoomsSlice = Pick<AppState, (typeof roomsSliceKeys)[number]>;

export const createRoomsSlice = (legacyState: AppState): RoomsSlice =>
  pickState(legacyState, roomsSliceKeys);
