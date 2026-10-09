import { ControllerConfig, CameraConfig } from "../types";
import { clamp } from "../utils/math";

interface LatencyCommand {
  tExecuteS: number;
  dPanVelDegPerS: number;
  dTiltVelDegPerS: number;
}

export class DualAxisPidController {
  private config: ControllerConfig;
  private camera: CameraConfig;
  private integralPanDeg: number = 0;
  private integralTiltDeg: number = 0;
  private prevErrPanDeg: number = 0;
  private prevErrTiltDeg: number = 0;
  private latencyQueue: LatencyCommand[] = [];

  public currentPanDeg: number = 0;
  public currentTiltDeg: number = 0;
  public saturatedPan: boolean = false;
  public saturatedTilt: boolean = false;

  constructor(config: ControllerConfig, camera: CameraConfig) {
    this.config = config;
    this.camera = camera;
  }

  reset(): void {
    this.integralPanDeg = 0;
    this.integralTiltDeg = 0;
    this.prevErrPanDeg = 0;
    this.prevErrTiltDeg = 0;
    this.latencyQueue = [];
    this.currentPanDeg = 0;
    this.currentTiltDeg = 0;
    this.saturatedPan = false;
    this.saturatedTilt = false;
  }

  update(
    errPanDeg: number,
    errTiltDeg: number,
    errRadialPx: number,
    dt: number,
    currentSimTimeS: number
  ): { panDeg: number; tiltDeg: number } {
    if (dt <= 0) return { panDeg: this.currentPanDeg, tiltDeg: this.currentTiltDeg };

    // Deadband check in image pixel space
    let ePan = errPanDeg;
    let eTilt = errTiltDeg;
    if (errRadialPx < this.config.deadbandPx) {
      ePan = 0;
      eTilt = 0;
    }

    // Integral accumulation with anti-windup clamping
    this.integralPanDeg += ePan * dt;
    this.integralPanDeg = clamp(
      this.integralPanDeg,
      -this.config.integralClampDeg,
      this.config.integralClampDeg
    );

    this.integralTiltDeg += eTilt * dt;
    this.integralTiltDeg = clamp(
      this.integralTiltDeg,
      -this.config.integralClampDeg,
      this.config.integralClampDeg
    );

    // Derivative terms
    const dErrPan = (ePan - this.prevErrPanDeg) / dt;
    const dErrTilt = (eTilt - this.prevErrTiltDeg) / dt;
    this.prevErrPanDeg = ePan;
    this.prevErrTiltDeg = eTilt;

    // Requested angular velocity (u = kp*e + ki*int + kd*deriv)
    let cmdPanVel = this.config.kp * ePan + this.config.ki * this.integralPanDeg + this.config.kd * dErrPan;
    let cmdTiltVel = this.config.kp * eTilt + this.config.ki * this.integralTiltDeg + this.config.kd * dErrTilt;

    // Speed limits
    cmdPanVel = clamp(cmdPanVel, -this.camera.panMaxSpeedDegPerS, this.camera.panMaxSpeedDegPerS);
    cmdTiltVel = clamp(cmdTiltVel, -this.camera.tiltMaxSpeedDegPerS, this.camera.tiltMaxSpeedDegPerS);

    // Transport delay FIFO
    const delayS = (this.camera.controlLatencyMs || 0) / 1000;
    this.latencyQueue.push({
      tExecuteS: currentSimTimeS + delayS,
      dPanVelDegPerS: cmdPanVel,
      dTiltVelDegPerS: cmdTiltVel,
    });

    let execPanVel = 0;
    let execTiltVel = 0;

    // Pop commands ready for execution
    while (this.latencyQueue.length > 0 && this.latencyQueue[0].tExecuteS <= currentSimTimeS) {
      const popped = this.latencyQueue.shift()!;
      execPanVel = popped.dPanVelDegPerS;
      execTiltVel = popped.dTiltVelDegPerS;
    }

    // Integrate commanded velocities into physical gimbal pose
    const nextPan = this.currentPanDeg + execPanVel * dt;
    const nextTilt = this.currentTiltDeg + execTiltVel * dt;

    // Clamping to camera physical mechanical limits
    const clampedPan = clamp(nextPan, this.camera.panLimitDeg[0], this.camera.panLimitDeg[1]);
    const clampedTilt = clamp(nextTilt, this.camera.tiltLimitDeg[0], this.camera.tiltLimitDeg[1]);

    this.saturatedPan = clampedPan !== nextPan;
    this.saturatedTilt = clampedTilt !== nextTilt;

    this.currentPanDeg = clampedPan;
    this.currentTiltDeg = clampedTilt;

    return { panDeg: this.currentPanDeg, tiltDeg: this.currentTiltDeg };
  }
}
