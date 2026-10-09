import { Vec2, CameraConfig } from "../types";
import { degToRad, radToDeg, focalLengthPx } from "../utils/math";

export interface ProjectionModel {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

export function createProjectionModel(camera: CameraConfig): ProjectionModel {
  return {
    fx: focalLengthPx(camera.widthPx, camera.hFovDeg),
    fy: focalLengthPx(camera.heightPx, camera.vFovDeg),
    cx: camera.widthPx / 2,
    cy: camera.heightPx / 2,
  };
}

/**
 * Projects 3D world direction (azimuth, elevation in degrees) to camera image space pixel coordinates.
 * Returns null if behind camera or outside field of view.
 */
export function projectWorldToImage(
  azDeg: number,
  elDeg: number,
  panDeg: number,
  tiltDeg: number,
  model: ProjectionModel,
  width: number,
  height: number
): Vec2 | null {
  const dAzRad = degToRad(azDeg - panDeg);
  const dElRad = degToRad(elDeg - tiltDeg);

  // Check forward hemisphere
  if (Math.cos(dAzRad) <= 0.05 || Math.cos(dElRad) <= 0.05) {
    return null;
  }

  const px = model.cx + model.fx * Math.tan(dAzRad);
  const py = model.cy - model.fy * Math.tan(dElRad);

  // Allow slight margin around viewport for clipping
  if (px < -40 || px > width + 40 || py < -40 || py > height + 40) {
    return null;
  }

  return { x: px, y: py };
}

/**
 * Converts image pixel coordinates to angular offset relative to camera optical axis in degrees.
 */
export function pixelToOpticalAnglesDeg(
  px: Vec2,
  model: ProjectionModel
): { dPanDeg: number; dTiltDeg: number } {
  const dx = px.x - model.cx;
  const dy = px.y - model.cy;
  const dPanDeg = radToDeg(Math.atan(dx / model.fx));
  const dTiltDeg = -radToDeg(Math.atan(dy / model.fy));
  return { dPanDeg, dTiltDeg };
}
