/**
 * Deterministic PRNG implementation using 32-bit Mulberry32.
 */
export class Prng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed ^ 0x12345678) >>> 0;
  }

  /**
   * Generates a pseudo-random float in [0, 1).
   */
  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state = t ^ (t >>> 14);
    return (this.state >>> 0) / 4294967296;
  }

  /**
   * Generates a sample from standard normal distribution N(0, 1) using Box-Muller.
   */
  nextGaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.nextFloat();
    while (v === 0) v = this.nextFloat();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Generates a sample from Poisson(lambda). Uses Knuth algorithm for small lambda,
   * Gaussian approximation for large lambda (lambda > 30).
   */
  nextPoisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda > 30) {
      const g = this.nextGaussian();
      const val = Math.round(lambda + Math.sqrt(lambda) * g);
      return Math.max(0, val);
    }
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.nextFloat();
    } while (p > L);
    return k - 1;
  }
}
