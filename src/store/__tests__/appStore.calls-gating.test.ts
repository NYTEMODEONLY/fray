import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlags } from "../../config/featureFlags";
import { useAppStore } from "../appStore";

const resetCallsState = () => {
  useAppStore.setState((state) => ({
    ...state,
    notifications: [],
    currentRoomId: "room_voice",
    rooms: [
      {
        id: "room_voice",
        spaceId: "all",
        name: "voice",
        type: "voice",
        category: "channels",
        unreadCount: 0
      }
    ],
    callState: {
      roomId: null,
      mode: null,
      joined: false,
      micMuted: false,
      videoMuted: true,
      screenSharing: false,
      localStream: null,
      remoteStreams: [],
      screenshareStreams: []
    }
  }));
};

describe("Calls feature flag gating", () => {
  beforeEach(() => {
    resetCallsState();
  });

  it("blocks joinCall when VITE_ENABLE_ADVANCED_CALLS is disabled", async () => {
    expect(featureFlags.enableAdvancedCalls).toBe(false);

    const waitUntilRoomReadyForGroupCalls = vi.fn();
    const getGroupCallForRoom = vi.fn();
    const createGroupCall = vi.fn();

    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getRoom: vi.fn(),
        waitUntilRoomReadyForGroupCalls,
        getGroupCallForRoom,
        createGroupCall
      } as never
    }));

    await useAppStore.getState().joinCall();

    expect(waitUntilRoomReadyForGroupCalls).not.toHaveBeenCalled();
    expect(getGroupCallForRoom).not.toHaveBeenCalled();
    expect(createGroupCall).not.toHaveBeenCalled();
    expect(useAppStore.getState().callState.joined).toBe(false);
    expect(useAppStore.getState().notifications[0]?.title).toBe("Calls disabled");
  });

  it("blocks mic/video/screenshare toggles when VITE_ENABLE_ADVANCED_CALLS is disabled", () => {
    const setMicrophoneMuted = vi.fn().mockResolvedValue(undefined);
    const setLocalVideoMuted = vi.fn().mockResolvedValue(undefined);
    const setScreensharingEnabled = vi.fn().mockResolvedValue(undefined);
    const leave = vi.fn();
    const call = {
      setMicrophoneMuted,
      setLocalVideoMuted,
      setScreensharingEnabled,
      leave
    };

    const getGroupCallForRoom = vi.fn(() => call);
    useAppStore.setState((state) => ({
      ...state,
      matrixClient: {
        getGroupCallForRoom
      } as never,
      callState: {
        ...state.callState,
        roomId: "room_voice",
        mode: "voice",
        joined: true
      }
    }));

    useAppStore.getState().toggleMic();
    useAppStore.getState().toggleVideo();
    useAppStore.getState().toggleScreenShare();

    expect(getGroupCallForRoom).not.toHaveBeenCalled();
    expect(setMicrophoneMuted).not.toHaveBeenCalled();
    expect(setLocalVideoMuted).not.toHaveBeenCalled();
    expect(setScreensharingEnabled).not.toHaveBeenCalled();

    useAppStore.getState().leaveCall();
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
