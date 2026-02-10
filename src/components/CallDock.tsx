import { useEffect, useRef } from "react";
import { CallFeed } from "matrix-js-sdk/lib/webrtc/callFeed";

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
    return (
      <section className="call-placeholder">
        <p className="eyebrow">Voice & Video</p>
        <h3>Off by default</h3>
        <p>Join a voice or video channel to start a call.</p>
      </section>
    );
  }

  return (
    <section className="call-dock">
      <div className="call-header">
        <div>
          <p className="eyebrow">MatrixRTC</p>
          <h3>
            {joined ? (mode === "video" ? "Live video room" : "Live voice room") : "Ready to join"}
          </h3>
        </div>
        <button className="pill" onClick={joined ? onLeave : onJoin}>
          {joined ? "Leave" : "Join"}
        </button>
      </div>

      <div className="call-controls">
        <button className={micMuted ? "pill warn" : "pill"} onClick={onToggleMic}>
          {micMuted ? "Muted" : "Mic on"}
        </button>
        <button className={videoMuted ? "pill warn" : "pill"} onClick={onToggleVideo}>
          {videoMuted ? "Cam off" : "Cam on"}
        </button>
        <button className={screenSharing ? "pill warn" : "pill"} onClick={onToggleScreen}>
          {screenSharing ? "Stop Share" : "Share Screen"}
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
    </section>
  );
};
