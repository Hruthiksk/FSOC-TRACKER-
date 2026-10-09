import { Detection, Vec2 } from "../types";
import { KalmanFilter } from "./kalman";

export interface AssociationResult {
  associatedDetection: Detection | null;
  minDistSq: number | null;
}

/**
 * Associates detections with active track using Mahalanobis gating.
 */
export function associateDetection(
  detections: Detection[],
  kalman: KalmanFilter | null,
  gateChi2: number,
  preferredCenterPx?: Vec2
): AssociationResult {
  if (detections.length === 0) {
    return { associatedDetection: null, minDistSq: null };
  }

  // When uninitialized or searching without Kalman filter
  if (!kalman) {
    if (preferredCenterPx) {
      // Find detection closest to preferred location with good brightness
      let bestDet: Detection = detections[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const d of detections) {
        const dx = d.centroidPx.x - preferredCenterPx.x;
        const dy = d.centroidPx.y - preferredCenterPx.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestDet = d;
        }
      }
      return { associatedDetection: bestDet, minDistSq: bestDist * bestDist };
    }
    // Highest peak intensity
    return { associatedDetection: detections[0], minDistSq: 0 };
  }

  // Gated association using Kalman innovation Mahalanobis distance
  let bestDetection: Detection | null = null;
  let minD2 = Number.POSITIVE_INFINITY;

  for (const det of detections) {
    const d2 = kalman.computeMahalanobisSq(det.centroidPx);
    if (d2 <= gateChi2 && d2 < minD2) {
      minD2 = d2;
      bestDetection = det;
    }
  }

  return {
    associatedDetection: bestDetection,
    minDistSq: Number.isFinite(minD2) ? minD2 : null,
  };
}
