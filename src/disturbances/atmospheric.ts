import { AtmosphereConfig, Vec2 } from "../types";
import { Prng } from "../utils/prng";

export class AtmosphericDisturbance {
  private config: AtmosphereConfig;
  private prng: Prng;
  private ouWanderX: number = 0;
  private ouWanderY: number = 0;

  constructor(config: AtmosphereConfig, seed: number) {
    this.config = config;
    this.prng = new Prng(seed + 101);
  }

  getTransmission(): number {
    if (this.config.weather === "CLEAR") return 1.0;
    const beta = this.config.weather === "FOG"
      ? Math.max(0.8, this.config.extinctionPerKm)
      : Math.max(0.3, this.config.extinctionPerKm * 0.6);
    return Math.exp(-beta * this.config.pathLengthKm);
  }

  getVeilingLight(): number {
    const T = this.getTransmission();
    const ambientSky = this.config.weather === "FOG" ? 65 : 35;
    return ambientSky * (1 - T);
  }

  /**
   * Evaluates beam-wander (Ornstein-Uhlenbeck correlated random walk)
   * and optical scintillation (multiplicative intensity factor).
   */
  evaluateTurbulence(dt: number): { wanderPx: Vec2; scintillationFactor: number } {
    if (this.config.turbulenceStrength <= 0) {
      return { wanderPx: { x: 0, y: 0 }, scintillationFactor: 1.0 };
    }

    const tau = Math.max(0.05, this.config.turbulenceCorrelationS);
    const theta = dt / tau;
    const sigma = this.config.turbulenceStrength * 4.5;

    // Ornstein-Uhlenbeck step: dx = -theta * x + sigma * sqrt(dt) * W
    this.ouWanderX += -theta * this.ouWanderX + sigma * Math.sqrt(dt) * this.prng.nextGaussian();
    this.ouWanderY += -theta * this.ouWanderY + sigma * Math.sqrt(dt) * this.prng.nextGaussian();

    // Scintillation log-normal factor: I = exp(mu + sigma_I * N(0,1))
    const sigI = this.config.turbulenceStrength * 0.4;
    const logNorm = Math.exp(-0.5 * sigI * sigI + sigI * this.prng.nextGaussian());

    return {
      wanderPx: { x: this.ouWanderX, y: this.ouWanderY },
      scintillationFactor: Math.max(0.2, Math.min(2.5, logNorm)),
    };
  }
}
