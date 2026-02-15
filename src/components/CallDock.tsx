import { useEffect, useRef } from "react";
import type { CallFeed } from "../matrix/client";
import { Mic, MicOff, PhoneCall, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from "lucide-react";

interface CallDockProps {
  mode: "voice" | "video" | null;
  joined: boolean;
  micMuted: boolean;
  videoMuted: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteStreams: CallFeed[];
  screenStreams: CallFeed[];
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
}

export const CallDock = ({
  mode,
  joined,
  micMuted,
  videoMuted,
  screenSharing,
  localStream,
  remoteStreams,
  screenStreams,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleVideo,
  onToggleScreen
}: CallDockProps) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!mode) {
    return null;
  }

  return (
    <aside className="call-dock">
      <div className="call-header">
        <div>
          <p className="eyebrow">Voice & Video</p>
          <h3>{joined ? (mode === "video" ? "Live video room" : "Live voice room") : "Ready to join"}</h3>
        </div>
        <button className="pill" onClick={joined ? onLeave : onJoin}>
          {joined ? <PhoneOff size={14} aria-hidden="true" /> : <PhoneCall size={14} aria-hidden="true" />}
          <span>{joined ? "Leave" : "Join"}</span>
        </button>
      </div>

      <div className="call-controls">
        <button className={micMuted ? "pill warn" : "pill"} onClick={onToggleMic}>
          {micMuted ? <MicOff size={14} aria-hidden="true" /> : <Mic size={14} aria-hidden="true" />}
          <span>{micMuted ? "Muted" : "Mic on"}</span>
        </button>
        <button className={videoMuted ? "pill warn" : "pill"} onClick={onToggleVideo}>
          {videoMuted ? <VideoOff size={14} aria-hidden="true" /> : <Video size={14} aria-hidden="true" />}
          <span>{videoMuted ? "Cam off" : "Cam on"}</span>
        </button>
        <button className={screenSharing ? "pill warn" : "pill"} onClick={onToggleScreen}>
          {screenSharing ? <ScreenShareOff size={14} aria-hidden="true" /> : <ScreenShare size={14} aria-hidden="true" />}
          <span>{screenSharing ? "Stop Share" : "Share Screen"}</span>
        </button>
      </div>

      <div className={micMuted || !joined ? "voice-meter muted" : "voice-meter"}>
        <span />
        <span />
        <span />
        <span />
      </div>

      {(localStream || remoteStreams.length > 0 || screenStreams.length > 0) && (
        <div className="call-previews">
          <div className="preview">
            <p>Local</p>
            <video ref={localVideoRef} autoPlay muted playsInline />
          </div>
          {screenStreams.slice(0, 1).map((feed) => (
            <div key={feed.stream.id} className="preview">
              <p>Screen</p>
              <video
                ref={(node) => {
                  if (node) node.srcObject = feed.stream;
                }}
                autoPlay
                muted
                playsInline
              />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
