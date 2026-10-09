import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { sharedSimulationEngine, EngineSnapshot } from "../simulation/engine";
import { formatTimeS } from "../utils/format";

export const Simulation3DPage: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const insetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => sharedSimulationEngine.getSnapshot());

  // Toggles
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showFOV, setShowFOV] = useState(true);
  const [showBeam, setShowBeam] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showInset, setShowInset] = useState(true);
  const [showGroundTruth, setShowGroundTruth] = useState(true);

  // Subscribe to engine
  useEffect(() => {
    let animId: number;
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (now - lastUpdate > 50) {
        setSnapshot(sharedSimulationEngine.getSnapshot());
        lastUpdate = now;
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Three.js 3D Scene setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 2000);
    camera.position.set(0, 180, 400);
    camera.lookAt(0, 40, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 200, 150);
    scene.add(dirLight);

    // Grid
    const gridHelper = new THREE.GridHelper(600, 30, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -20;
    scene.add(gridHelper);

    // Axes
    const axesHelper = new THREE.AxesHelper(60);
    axesHelper.position.set(-180, -18, -180);
    scene.add(axesHelper);

    // Ground Platform: Receiver Base & Mast
    const baseGeo = new THREE.CylinderGeometry(20, 24, 8, 32);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -16, 0);
    scene.add(baseMesh);

    // Gimbal Mast
    const mastGeo = new THREE.CylinderGeometry(5, 5, 40, 16);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const mastMesh = new THREE.Mesh(mastGeo, mastMat);
    mastMesh.position.set(0, 8, 0);
    scene.add(mastMesh);

    // Camera Gimbal Head (Rotates Pan & Tilt)
    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.set(0, 28, 0);
    scene.add(gimbalGroup);

    const headGeo = new THREE.BoxGeometry(16, 12, 22);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    gimbalGroup.add(headMesh);

    // Lens
    const lensGeo = new THREE.CylinderGeometry(5, 5, 6, 16);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.rotation.x = Math.PI / 2;
    lensMesh.position.set(0, 0, 13);
    gimbalGroup.add(lensMesh);

    // Target Beacon Sphere
    const beaconGeo = new THREE.SphereGeometry(6, 24, 24);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.8,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(0, 80, -250);
    scene.add(beaconMesh);

    // FOV Frustum (Lines)
    const fovLinesGeo = new THREE.BufferGeometry();
    const fovLinesMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
    });
    const fovLines = new THREE.LineSegments(fovLinesGeo, fovLinesMat);
    gimbalGroup.add(fovLines);

    // Simulated Laser Beam Line
    const beamGeo = new THREE.BufferGeometry();
    const beamMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const beamLine = new THREE.Line(beamGeo, beamMat);
    scene.add(beamLine);

    // Trajectory Path (Ring or Curve)
    const trajPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI;
      trajPoints.push(new THREE.Vector3(120 * Math.cos(theta), 80 + 30 * Math.sin(theta), -250));
    }
    const trajGeo = new THREE.BufferGeometry().setFromPoints(trajPoints);
    const trajMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    scene.add(trajLine);

    // Mouse Drag Rotation
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: 460, theta: 0, phi: Math.PI / 3 };

    const updateCameraPos = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 40, 0);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.005));
      updateCameraPos();
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      spherical.radius = Math.max(150, Math.min(800, spherical.radius + e.deltaY * 0.3));
      updateCameraPos();
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel);

    // Resize handler
    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // Animation Loop
    let animId: number;
    const renderScene = () => {
      const snap = sharedSimulationEngine.getSnapshot();

      // Pan & Tilt applied to gimbal group
      // Camera optical axis points towards -Z in Three.js when rotated
      const panRad = THREE.MathUtils.degToRad(-snap.cameraPose.panDeg);
      const tiltRad = THREE.MathUtils.degToRad(snap.cameraPose.tiltDeg);
      gimbalGroup.rotation.y = panRad;
      gimbalGroup.rotation.x = tiltRad;

      // Update Target Beacon 3D Position
      const range = 260;
      // Map world angles
      let targetAz = 0;
      let targetEl = 0;
      if (snap.currentFrame && snap.currentFrame.groundTruthPx) {
        const normX = (snap.currentFrame.groundTruthPx.x - 320) / 320;
        const normY = (snap.currentFrame.groundTruthPx.y - 240) / 240;
        targetAz = normX * (snap.config.camera.hFovDeg * 0.35) + snap.cameraPose.panDeg;
        targetEl = -normY * (snap.config.camera.vFovDeg * 0.35) + snap.cameraPose.tiltDeg;
      }

      const tx = range * Math.sin(THREE.MathUtils.degToRad(targetAz));
      const ty = 28 + range * Math.sin(THREE.MathUtils.degToRad(targetEl));
      const tz = -range * Math.cos(THREE.MathUtils.degToRad(targetAz));
      beaconMesh.position.set(tx, ty, tz);

      // Update FOV Frustum
      const frustumDist = 200;
      const hHalf = frustumDist * Math.tan(THREE.MathUtils.degToRad(snap.config.camera.hFovDeg / 2));
      const vHalf = frustumDist * Math.tan(THREE.MathUtils.degToRad(snap.config.camera.vFovDeg / 2));

      // 4 corners of far plane
      const p1 = new THREE.Vector3(-hHalf, vHalf, -frustumDist);
      const p2 = new THREE.Vector3(hHalf, vHalf, -frustumDist);
      const p3 = new THREE.Vector3(hHalf, -vHalf, -frustumDist);
      const p4 = new THREE.Vector3(-hHalf, -vHalf, -frustumDist);
      const origin = new THREE.Vector3(0, 0, 0);

      const frustumVerts = [
        origin, p1, origin, p2, origin, p3, origin, p4,
        p1, p2, p2, p3, p3, p4, p4, p1,
      ];
      fovLinesGeo.setFromPoints(frustumVerts);

      // Update Beam Line from Gimbal to Beacon
      const gimbalWorldPos = new THREE.Vector3();
      gimbalGroup.getWorldPosition(gimbalWorldPos);
      beamGeo.setFromPoints([gimbalWorldPos, beaconMesh.position]);

      // Toggles
      gridHelper.visible = showGrid;
      axesHelper.visible = showAxes;
      fovLines.visible = showFOV;
      beamLine.visible = showBeam && snap.linkState === "SIMULATED_ACTIVE";
      beaconMesh.visible = showGroundTruth;
      trajLine.visible = showTrajectory;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderScene);
    };

    animId = requestAnimationFrame(renderScene);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [showGrid, showAxes, showFOV, showBeam, showTrajectory, showGroundTruth]);

  // Inset Camera Draw Loop
  useEffect(() => {
    if (!showInset) return;
    const canvas = insetCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = sharedSimulationEngine.getLatestImageData();
    if (imgData) {
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.putImageData(imgData, 0, 0);

      // Inset Crosshair
      ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(imgData.width / 2, 0);
      ctx.lineTo(imgData.width / 2, imgData.height);
      ctx.moveTo(0, imgData.height / 2);
      ctx.lineTo(imgData.width, imgData.height / 2);
      ctx.stroke();
    }
  }, [snapshot, showInset]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#060913]">
      {/* 3D Scene Container */}
      <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Toggles Bar */}
      <div className="absolute top-3 left-3 bg-[#080d1a]/85 backdrop-blur-sm border border-[#1e293b] rounded p-2.5 flex flex-wrap items-center gap-3 text-xs font-mono text-slate-300 z-10">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showBeam}
            onChange={(e) => setShowBeam(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span className="text-emerald-400 font-semibold">SIMULATED BEAM</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showFOV}
            onChange={(e) => setShowFOV(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span>FOV Frustum</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrajectory}
            onChange={(e) => setShowTrajectory(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span>Trajectory</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span>Grid</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showInset}
            onChange={(e) => setShowInset(e.target.checked)}
            className="rounded accent-cyan-500"
          />
          <span>Inset View</span>
        </label>
      </div>

      {/* OSD Gimbal Pose Box */}
      <div className="absolute bottom-3 left-3 bg-[#080d1a]/85 backdrop-blur-sm border border-[#1e293b] rounded p-3 text-xs font-mono text-slate-300 z-10 space-y-1">
        <div>TIME: <strong className="text-slate-100">{formatTimeS(snapshot.simTimeS)}</strong></div>
        <div>PAN: <strong className="text-cyan-400">{snapshot.cameraPose.panDeg.toFixed(2)}&deg;</strong> &bull; TILT: <strong className="text-cyan-400">{snapshot.cameraPose.tiltDeg.toFixed(2)}&deg;</strong></div>
        <div>LINK STATE: <span className="text-emerald-400">{snapshot.linkState}</span></div>
        <div className="text-[10px] text-slate-500">Drag to orbit &bull; Scroll to zoom</div>
      </div>

      {/* Inset Camera Viewport (Top Right) */}
      {showInset && (
        <div className="absolute top-3 right-3 w-48 sm:w-56 bg-black/90 border border-[#1e293b] rounded overflow-hidden shadow-2xl z-10">
          <div className="px-2 py-1 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center justify-between">
            <span>INSET SENSOR FEED</span>
            <span>{snapshot.currentFrame?.state}</span>
          </div>
          <canvas ref={insetCanvasRef} className="w-full aspect-[4/3] block" />
        </div>
      )}
    </div>
  );
};
