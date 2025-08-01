import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function StreamPlayer() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;

    // HLS.js нужен для Chrome/Firefox/Edge
    if (Hls.isSupported()) {
      const hls = new Hls({
        liveDurationInfinity: true,
        enableWorker: true,
        lowLatencyMode: true
      });
      hls.loadSource("http://localhost:8080/hls/stream.m3u8"); // URL до Ktor
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari поддерживает HLS напрямую
      video.src = "http://localhost:8080/hls/stream.m3u8";
    }
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted
        width="640"
        height="360"
        style={{ backgroundColor: "black" }}
      />
    </div>
  );
}