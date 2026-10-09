import { Vec2 } from "../types";

/**
 * Calculates Euclidean 2D distance.
 */
export function euclideanDist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Converts degrees to radians.
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Clamps numeric value to range [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes focal length in pixels given frame dimension and field of view in degrees.
 */
export function focalLengthPx(dimPx: number, fovDeg: number): number {
  return (dimPx / 2) / Math.tan(degToRad(fovDeg) / 2);
}

/**
 * Converts image pixel offset to optical angular offset in degrees.
 */
export function pixelToAngleDeg(offsetPx: number, focalPx: number): number {
  return radToDeg(Math.atan(offsetPx / focalPx));
}

/**
 * Converts optical angular offset in degrees to image pixel offset.
 */
export function angleToPixel(angleDeg: number, focalPx: number): number {
  return focalPx * Math.tan(degToRad(angleDeg));
}

/**
 * Computes 2x2 matrix inversion [ [a, b], [c, d] ].
 */
export function invert2x2(m: [[number, number], [number, number]]): [[number, number], [number, number]] | null {
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    [m[1][1] * invDet, -m[0][1] * invDet],
    [-m[1][0] * invDet, m[0][0] * invDet],
  ];
}

/**
 * Computes Mahalanobis distance squared y^T S^-1 y for 2D innovation and 2x2 covariance.
 */
export function mahalanobisDistSq2D(
  y: [number, number],
  S: [[number, number], [number, number]]
): number {
  const S_inv = invert2x2(S);
  if (!S_inv) return Number.POSITIVE_INFINITY;
  const invY0 = S_inv[0][0] * y[0] + S_inv[0][1] * y[1];
  const invY1 = S_inv[1][0] * y[0] + S_inv[1][1] * y[1];
  return y[0] * invY0 + y[1] * invY1;
}
