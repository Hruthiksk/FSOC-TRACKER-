import { TrackingState, TrackerConfig, TrackerEvent } from "../types";

export interface StateMachineUpdateResult {
  state: TrackingState;
  eventsToEmit: Omit<TrackerEvent, "id" | "sessionId" | "wallClockIso">[];
}

export class TrackingStateMachine {
  public state: TrackingState = "SEARCHING";
  private config: TrackerConfig;
  private maxCoastFrames: number;

  private consecutiveDetections: number = 0;
  private consecutiveWithinLockRadius: number = 0;
  private consecutiveMissed: number = 0;

  public acquisitionStartTimeS: number | null = null;
  public firstLockedTimeS: number | null = null;
  public lastLossTimeS: number | null = null;
  public reacquisitionTimes: number[] = [];
  public lossCount: number = 0;

  constructor(config: TrackerConfig, maxCoastFrames: number) {
    this.config = config;
    this.maxCoastFrames = maxCoastFrames;
  }

  reset(): void {
    this.state = "SEARCHING";
    this.consecutiveDetections = 0;
    this.consecutiveWithinLockRadius = 0;
    this.consecutiveMissed = 0;
    this.acquisitionStartTimeS = null;
    this.firstLockedTimeS = null;
    this.lastLossTimeS = null;
    this.reacquisitionTimes = [];
    this.lossCount = 0;
  }

  step(
    hasDetection: boolean,
    radialErrorPx: number | null,
    tS: number,
    covarianceTrace: number
  ): StateMachineUpdateResult {
    const events: Omit<TrackerEvent, "id" | "sessionId" | "wallClockIso">[] = [];

    if (this.acquisitionStartTimeS === null) {
      this.acquisitionStartTimeS = tS;
    }

    switch (this.state) {
      case "SEARCHING": {
        if (hasDetection) {
          this.state = "ACQUIRING";
          this.consecutiveDetections = 1;
          this.consecutiveMissed = 0;
          this.consecutiveWithinLockRadius =
            radialErrorPx !== null && radialErrorPx <= this.config.lockRadiusPx ? 1 : 0;
          events.push({
            tS,
            severity: "INFO",
            code: "BEACON_DETECTED",
            message: "Beacon candidate acquired. Initiating track confirmation.",
          });
        }
        break;
      }

      case "ACQUIRING": {
        if (hasDetection) {
          this.consecutiveDetections++;
          this.consecutiveMissed = 0;

          if (radialErrorPx !== null && radialErrorPx <= this.config.lockRadiusPx) {
            this.consecutiveWithinLockRadius++;
          } else {
            this.consecutiveWithinLockRadius = 0;
          }

          if (
            this.consecutiveDetections >= this.config.acquireFrames &&
            this.consecutiveWithinLockRadius >= this.config.lockFrames
          ) {
            this.state = "LOCKED";
            if (this.firstLockedTimeS === null) {
              this.firstLockedTimeS = tS;
            }
            if (this.lastLossTimeS !== null) {
              const dtReacquired = Math.max(0, tS - this.lastLossTimeS);
              this.reacquisitionTimes.push(dtReacquired);
              this.lastLossTimeS = null;
            }
            events.push({
              tS,
              severity: "SUCCESS",
              code: "TRACKING_LOCKED",
              message: `Coarse tracking lock established (error: ${radialErrorPx?.toFixed(1) ?? "0"} px).`,
            });
          }
        } else {
          this.consecutiveMissed++;
          if (this.consecutiveMissed > 4) {
            this.state = "SEARCHING";
            this.consecutiveDetections = 0;
            this.consecutiveWithinLockRadius = 0;
          }
        }
        break;
      }

      case "LOCKED": {
        if (hasDetection) {
          this.consecutiveMissed = 0;
        } else {
          this.consecutiveMissed++;
          if (this.consecutiveMissed === 1) {
            events.push({
              tS,
              severity: "WARNING",
              code: "PREDICTION_ONLY_STARTED",
              message: "Beacon detection dropped. Running Kalman prediction coasting.",
            });
          }

          if (this.consecutiveMissed > this.maxCoastFrames || covarianceTrace > 2500) {
            this.state = "LOST";
            this.lossCount++;
            this.lastLossTimeS = tS;
            events.push({
              tS,
              severity: "ERROR",
              code: "TARGET_LOST",
              message: `Target lost after ${this.consecutiveMissed} missed frames. Re-entering search.`,
            });
          }
        }
        break;
      }

      case "LOST": {
        if (hasDetection) {
          this.state = "ACQUIRING";
          this.consecutiveDetections = 1;
          this.consecutiveMissed = 0;
          this.consecutiveWithinLockRadius = 0;
          events.push({
            tS,
            severity: "INFO",
            code: "BEACON_REACQUIRED",
            message: "Beacon signal re-detected. Re-acquiring track.",
          });
        }
        break;
      }
    }

    return { state: this.state, eventsToEmit: events };
  }
}
