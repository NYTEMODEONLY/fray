import type { AppState, AppStateGet, AppStateSet } from "../shared";
import {
  GroupCallEvent,
  GroupCallIntent,
  GroupCallType,
  areAdvancedCallsEnabled,
  defaultCallState
} from "../shared";

export type CallsSliceState = Pick<
  AppState,
  | "callState"
  | "joinCall"
  | "leaveCall"
  | "toggleMic"
  | "toggleVideo"
  | "toggleScreenShare"
>;

export const createCallsSliceState = (
  set: AppStateSet,
  get: AppStateGet
): CallsSliceState => ({
  callState: defaultCallState,
  joinCall: async () => {
    if (!areAdvancedCallsEnabled()) {
      get().pushNotification("Calls disabled", "Enable VITE_ENABLE_ADVANCED_CALLS to use call controls.");
      return;
    }

    const client = get().matrixClient;
    const roomId = get().currentRoomId;
    if (!client) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    const roomType = get().rooms.find((r) => r.id === roomId)?.type;
    const mode = roomType === "video" ? "video" : roomType === "voice" ? "voice" : null;
    if (!mode) return;

    await client.waitUntilRoomReadyForGroupCalls(roomId);

    let call = client.getGroupCallForRoom(roomId);
    if (!call) {
      call = await client.createGroupCall(
        roomId,
        mode === "video" ? GroupCallType.Video : GroupCallType.Voice,
        false,
        GroupCallIntent.Room
      );
    }

    call.on(GroupCallEvent.UserMediaFeedsChanged, (feeds) => {
      set((state) => ({
        callState: {
          ...state.callState,
          remoteStreams: feeds.filter((feed) => feed.userId !== client.getUserId())
        }
      }));
    });
    call.on(GroupCallEvent.ScreenshareFeedsChanged, (feeds) => {
      set((state) => ({
        callState: {
          ...state.callState,
          screenshareStreams: feeds
        }
      }));
    });
    call.on(GroupCallEvent.LocalScreenshareStateChanged, (enabled) => {
      set((state) => ({
        callState: {
          ...state.callState,
          screenSharing: enabled
        }
      }));
    });
    call.on(GroupCallEvent.LocalMuteStateChanged, (micMuted, videoMuted) => {
      set((state) => ({
        callState: {
          ...state.callState,
          micMuted,
          videoMuted
        }
      }));
    });

    await call.enter();

    const localFeed = call.localCallFeed;
    set({
      callState: {
        roomId,
        mode,
        joined: true,
        micMuted: call.isMicrophoneMuted(),
        videoMuted: call.isLocalVideoMuted(),
        screenSharing: call.isScreensharing(),
        localStream: localFeed?.stream ?? null,
        remoteStreams: call.userMediaFeeds ?? [],
        screenshareStreams: call.screenshareFeeds ?? []
      }
    });
  },
  leaveCall: () => {
    const client = get().matrixClient;
    const callState = get().callState;
    if (client && callState.roomId) {
      const call = client.getGroupCallForRoom(callState.roomId);
      call?.leave();
    }
    set({ callState: defaultCallState });
  },
  toggleMic: () => {
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setMicrophoneMuted(!callState.micMuted).catch(() => undefined);
  },
  toggleVideo: () => {
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    call.setLocalVideoMuted(!callState.videoMuted).catch(() => undefined);
  },
  toggleScreenShare: () => {
    if (!areAdvancedCallsEnabled()) return;
    const client = get().matrixClient;
    const callState = get().callState;
    if (!client || !callState.roomId) return;
    const call = client.getGroupCallForRoom(callState.roomId);
    if (!call) return;
    const next = !(callState.screenSharing ?? false);
    call.setScreensharingEnabled(next).catch(() => undefined);
  }
});
