import type { AppState } from "../../internal/store/createLegacyAppState";
import { pickState } from "./pickState";

const messagesSliceKeys = [
  "messagesByRoomId",
  "threadRootId",
  "replyToId",
  "showThread",
  "showPins",
  "toggleThread",
  "togglePins",
  "sendMessage",
  "toggleReaction",
  "togglePin",
  "redactMessage",
  "copyMessageLink",
  "startReply",
  "clearReply",
  "simulateIncoming"
] as const satisfies readonly (keyof AppState)[];

export type MessagesSlice = Pick<AppState, (typeof messagesSliceKeys)[number]>;

export const createMessagesSlice = (legacyState: AppState): MessagesSlice =>
  pickState(legacyState, messagesSliceKeys);
