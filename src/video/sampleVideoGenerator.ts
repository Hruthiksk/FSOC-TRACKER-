/**
 * Utility to generate client-side synthetic WebM video blobs using Canvas and MediaRecorder.
 * Provides clean and noisy test videos for immediate benchmarking.
 */
export async function generateSyntheticBeaconVideoBlob(
  type: "clean" | "noisy" | "no_beacon",
  durationSec: number = 5
): Promise<Blob> {
  const width = 640;
  const height = 480;
  const fps = 30;
  const totalFrames = durationSec * fps;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  let bx = width / 2;
  let by = height / 2;

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;

    // Background
    ctx.fillStyle = type === "noisy" ? "#1e293b" : "#0b1220";
    ctx.fillRect(0, 0, width, height);

    if (type !== "no_beacon") {
      // Beacon movement (circle or figure eight)
      const r = 100;
      bx = width / 2 + r * Math.sin(t * 1.8);
      by = height / 2 + r * 0.6 * Math.sin(t * 3.6);

      // Render Gaussian-like spot
      const rad = ctx.createRadialGradient(bx, by, 1, bx, by, 14);
      rad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      rad.addColorStop(0.3, "rgba(230, 245, 255, 0.85)");
      rad.addColorStop(1.0, "rgba(100, 180, 255, 0.0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, 2 * Math.PI);
      ctx.fill();
    }

    if (type === "noisy") {
      // Draw simulated camera noise / dust spots
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      for (let k = 0; k < 40; k++) {
        const nx = Math.random() * width;
        const ny = Math.random() * height;
        ctx.fillRect(nx, ny, 2, 2);
      }
    }

    // Frame delay for real-time capture
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  return recordingPromise;
}
