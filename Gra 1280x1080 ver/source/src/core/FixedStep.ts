/** Фіксований крок симуляції: логіка не залежить від частоти кадрів. */
export class FixedStepper {
  private acc = 0;
  constructor(
    readonly step: number,
    private readonly maxStepsPerFrame = 8,
  ) {}

  advance(frameDtSec: number, tick: (dt: number) => void): void {
    this.acc += Math.min(frameDtSec, 0.25);
    let n = 0;
    while (this.acc >= this.step && n < this.maxStepsPerFrame) {
      tick(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === this.maxStepsPerFrame) this.acc = 0;
  }
}
