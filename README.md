# FSOC Tracker: Virtual Camera Tracking for Coarse FSOC Alignment

**Event:** Smart India Hackathon 2026  
**Team:** Control + Alt + Defeat (Team ID 146)  
**Problem Statement:** Development of an AI-based virtual camera tracking system for coarse alignment of mobile Free Space Optical Communication (FSOC).

---

## 1. Project Overview & Mission

Free Space Optical Communication (FSOC) links establish high-bandwidth, tap-proof optical links between moving platforms (e.g. UAVs, ground stations, maritime vessels). Before sub-microradian fine pointing mirrors can lock the laser beam, a **coarse alignment stage** must:
1. Detect an optical beacon in a wide camera view.
2. Maintain track of the beacon near the image center while the platform moves.
3. Reject optical disturbances: atmospheric extinction (fog/haze), beam wander, scintillation, readout noise, and platform vibration.

**FSOC Tracker** is a client-side virtual testbench and benchmarking suite for the coarse alignment loop.

---

## 2. Mandatory Scientific Honesty Disclosures

1. **Simulated Environment:** All simulations, optical paths, and synthetic camera frames are generated inside the browser. No physical FSOC transceivers or lasers are connected.
2. **Classical CV & Kalman Estimation:** Beacon detection is classical computer vision (Rec. 601 grayscale, 3-tap Gaussian filter, Otsu/adaptive thresholding, union-find connected components, intensity-weighted centroid). Estimation uses a 4-state constant-velocity Kalman filter with Mahalanobis validation gating.
3. **Pixel Error vs. Angular Error:** Pixel error denotes image-space coordinates. Angular error is derived geometrically from camera FOV.
4. **Honest Metrics:** Frames with lost detections are counted as losses and excluded from pixel statistics rather than zeroed out.

---

## 3. Installation & CLI Commands

```bash
# Install dependencies
npm install

# Run Vite development server (Port 3000)
npm run dev

# Type check / Lint
npm run lint

# Run automated acceptance test suite (Vitest)
npm test

# Run headless 12-second benchmark comparison
npm run bench

# Production build
npm run build
```

---

## 4. Supported Video Formats

- **Container:** MP4, WebM
- **Codecs:** H.264, VP8, VP9
- **Recommended Resolution:** 640x480 up to 1280x720
- **Built-in generator:** Instant one-click generation of synthetic clean, noisy, and dark test videos directly in the browser via Canvas MediaRecorder.
