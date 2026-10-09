import { KalmanConfig, Vec2 } from "../types";
import { mahalanobisDistSq2D, invert2x2 } from "../utils/math";

export class KalmanFilter {
  // State: [x, y, vx, vy]
  public state: [number, number, number, number];
  // Covariance matrix 4x4
  public P: number[][];
  private config: KalmanConfig;
  public consecutiveMissedFrames: number = 0;

  constructor(initialPos: Vec2, config: KalmanConfig) {
    this.config = config;
    this.state = [initialPos.x, initialPos.y, 0, 0];
    const pPos = config.initialPositionVarPx2;
    const pVel = config.initialVelocityVar;
    this.P = [
      [pPos, 0, 0, 0],
      [0, pPos, 0, 0],
      [0, 0, pVel, 0],
      [0, 0, 0, pVel],
    ];
  }

  predict(dt: number): void {
    if (dt <= 0) return;
    const [x, y, vx, vy] = this.state;
    // s = F * s
    this.state = [
      x + vx * dt,
      y + vy * dt,
      vx,
      vy,
    ];

    // F * P * F^T
    // Let FP = F * P
    const FP: number[][] = [
      [this.P[0][0] + dt * this.P[2][0], this.P[0][1] + dt * this.P[2][1], this.P[0][2] + dt * this.P[2][2], this.P[0][3] + dt * this.P[2][3]],
      [this.P[1][0] + dt * this.P[3][0], this.P[1][1] + dt * this.P[3][1], this.P[1][2] + dt * this.P[3][2], this.P[1][3] + dt * this.P[3][3]],
      [this.P[2][0], this.P[2][1], this.P[2][2], this.P[2][3]],
      [this.P[3][0], this.P[3][1], this.P[3][2], this.P[3][3]],
    ];

    // P_pred = FP * F^T
    const P_pred: number[][] = [
      [FP[0][0] + dt * FP[0][2], FP[0][1] + dt * FP[0][3], FP[0][2], FP[0][3]],
      [FP[1][0] + dt * FP[1][2], FP[1][1] + dt * FP[1][3], FP[1][2], FP[1][3]],
      [FP[2][0] + dt * FP[2][2], FP[2][1] + dt * FP[2][3], FP[2][2], FP[2][3]],
      [FP[3][0] + dt * FP[3][2], FP[3][1] + dt * FP[3][3], FP[3][2], FP[3][3]],
    ];

    // Discrete white noise acceleration Q
    const q = this.config.processNoiseAccel;
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt2 * dt2;
    const q11 = q * (dt4 / 4);
    const q12 = q * (dt3 / 2);
    const q22 = q * dt2;

    this.P = [
      [P_pred[0][0] + q11, P_pred[0][1], P_pred[0][2] + q12, P_pred[0][3]],
      [P_pred[1][0], P_pred[1][1] + q11, P_pred[1][2], P_pred[1][3] + q12],
      [P_pred[2][0] + q12, P_pred[2][1], P_pred[2][2] + q22, P_pred[2][3]],
      [P_pred[3][0], P_pred[3][1] + q12, P_pred[3][2], P_pred[3][3] + q22],
    ];

    this.symmetrizeP();
  }

  getInnovationCovariance2x2(): [[number, number], [number, number]] {
    const r = this.config.measurementNoisePx * this.config.measurementNoisePx;
    return [
      [this.P[0][0] + r, this.P[0][1]],
      [this.P[1][0], this.P[1][1] + r],
    ];
  }

  computeMahalanobisSq(measurement: Vec2): number {
    const y: [number, number] = [
      measurement.x - this.state[0],
      measurement.y - this.state[1],
    ];
    const S = this.getInnovationCovariance2x2();
    return mahalanobisDistSq2D(y, S);
  }

  update(measurement: Vec2): { innovationNorm: number } {
    const y: [number, number] = [
      measurement.x - this.state[0],
      measurement.y - this.state[1],
    ];
    const S = this.getInnovationCovariance2x2();
    const S_inv = invert2x2(S);
    if (!S_inv) {
      return { innovationNorm: Math.sqrt(y[0] * y[0] + y[1] * y[1]) };
    }

    // Kalman gain K = P * H^T * S^-1 (4x2 matrix)
    // H = [ [1,0,0,0], [0,1,0,0] ], so P * H^T is columns 0 and 1 of P
    const PHt: [number, number][] = [
      [this.P[0][0], this.P[0][1]],
      [this.P[1][0], this.P[1][1]],
      [this.P[2][0], this.P[2][1]],
      [this.P[3][0], this.P[3][1]],
    ];

    const K: [number, number][] = [
      [PHt[0][0] * S_inv[0][0] + PHt[0][1] * S_inv[1][0], PHt[0][0] * S_inv[0][1] + PHt[0][1] * S_inv[1][1]],
      [PHt[1][0] * S_inv[0][0] + PHt[1][1] * S_inv[1][0], PHt[1][0] * S_inv[0][1] + PHt[1][1] * S_inv[1][1]],
      [PHt[2][0] * S_inv[0][0] + PHt[2][1] * S_inv[1][0], PHt[2][0] * S_inv[0][1] + PHt[2][1] * S_inv[1][1]],
      [PHt[3][0] * S_inv[0][0] + PHt[3][1] * S_inv[1][0], PHt[3][0] * S_inv[0][1] + PHt[3][1] * S_inv[1][1]],
    ];

    // State update: s = s + K * y
    for (let i = 0; i < 4; i++) {
      this.state[i] += K[i][0] * y[0] + K[i][1] * y[1];
    }

    // Joseph form covariance update: P = (I - K*H)*P*(I - K*H)^T + K*R*K^T
    // I_KH = I - K * H (4x4)
    const I_KH: number[][] = [
      [1 - K[0][0], -K[0][1], 0, 0],
      [-K[1][0], 1 - K[1][1], 0, 0],
      [-K[2][0], -K[2][1], 1, 0],
      [-K[3][0], -K[3][1], 0, 1],
    ];

    // Temp = I_KH * P
    const Temp: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += I_KH[i][k] * this.P[k][j];
        Temp[i][j] = sum;
      }
    }

    // NewP = Temp * (I_KH)^T
    const NewP: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += Temp[i][k] * I_KH[j][k];
        NewP[i][j] = sum;
      }
    }

    // Add K * R * K^T where R = diag(r, r)
    const r = this.config.measurementNoisePx * this.config.measurementNoisePx;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        NewP[i][j] += r * (K[i][0] * K[j][0] + K[i][1] * K[j][1]);
      }
    }

    this.P = NewP;
    this.symmetrizeP();
    this.consecutiveMissedFrames = 0;

    return { innovationNorm: Math.sqrt(y[0] * y[0] + y[1] * y[1]) };
  }

  coast(): void {
    this.consecutiveMissedFrames++;
  }

  getPosition(): Vec2 {
    return { x: this.state[0], y: this.state[1] };
  }

  getVelocity(): Vec2 {
    return { x: this.state[2], y: this.state[3] };
  }

  getPositionStdPx(): number {
    return Math.sqrt(Math.max(0.01, 0.5 * (this.P[0][0] + this.P[1][1])));
  }

  getCovarianceTrace(): number {
    return this.P[0][0] + this.P[1][1] + this.P[2][2] + this.P[3][3];
  }

  private symmetrizeP(): void {
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const avg = 0.5 * (this.P[i][j] + this.P[j][i]);
        this.P[i][j] = avg;
        this.P[j][i] = avg;
      }
      if (this.P[i][i] < 1e-4) this.P[i][i] = 1e-4;
    }
  }
}
