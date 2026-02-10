import { useCallback, useState } from "react";

export const useMediaPreview = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  };

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
    } catch (err) {
      setError("Camera access denied.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopStream(cameraStream);
    setCameraStream(null);
  }, [cameraStream]);

  const startScreen = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setScreenStream(stream);
    } catch (err) {
      setError("Screen share cancelled.");
    }
  }, []);

  const stopScreen = useCallback(() => {
    stopStream(screenStream);
    setScreenStream(null);
  }, [screenStream]);

  return {
    cameraStream,
    screenStream,
    error,
    startCamera,
    stopCamera,
    startScreen,
    stopScreen
  };
};
