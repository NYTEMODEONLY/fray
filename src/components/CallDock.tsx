import { useEffect, useRef, useState } from "react";
import { useMediaPreview } from "../hooks/useMediaPreview";

export const CallDock = () => {
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);
  const { cameraStream, screenStream, error, startCamera, stopCamera, startScreen, stopScreen } =
    useMediaPreview();

  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (screenRef.current) {
      screenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  return (
    <section className="call-dock">
      <div className="call-header">
        <div>
          <p className="eyebrow">MatrixRTC</p>
          <h3>{inCall ? "Live in War Room" : "Voice ready"}</h3>
        </div>
        <button className="pill" onClick={() => setInCall((state) => !state)}>
          {inCall ? "Leave" : "Join"}
        </button>
      </div>

      <div className="call-controls">
        <button className={muted ? "pill warn" : "pill"} onClick={() => setMuted((s) => !s)}>
          {muted ? "Muted" : "Mic on"}
        </button>
        <button className={deafened ? "pill warn" : "pill"} onClick={() => setDeafened((s) => !s)}>
          {deafened ? "Deafened" : "Audio on"}
        </button>
        <button className="pill" onClick={() => (cameraStream ? stopCamera() : startCamera())}>
          {cameraStream ? "Stop Cam" : "Start Cam"}
        </button>
        <button className="pill" onClick={() => (screenStream ? stopScreen() : startScreen())}>
          {screenStream ? "Stop Share" : "Share Screen"}
        </button>
      </div>

      <div className={muted || !inCall ? "voice-meter muted" : "voice-meter"}>
        <span />
        <span />
        <span />
        <span />
      </div>

      {error && <p className="call-error">{error}</p>}

      <div className="call-previews">
        <div className="preview">
          <p>Camera</p>
          <video ref={cameraRef} autoPlay muted playsInline />
        </div>
        <div className="preview">
          <p>Screen</p>
          <video ref={screenRef} autoPlay muted playsInline />
        </div>
      </div>
    </section>
  );
};
