import type Phaser from 'phaser';
import { clamp, lerp } from '../core/math';
import type { CameraConfig } from '../data/cameraConfig';

/**
 * Камера: тримає лідера біля центру, відтягується за курсором, відʼїжджає сходинками,
 * коли відряд росте. Уся логіка камери — тут, сцена лише викликає update().
 */
export class CameraRig {
  private cx = 0;
  private cy = 0;
  private zoom: number;

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly cfg: CameraConfig,
    start: { x: number; y: number },
  ) {
    this.cx = start.x;
    this.cy = start.y;
    this.zoom = cfg.zoomSteps[0]?.zoom ?? 1;
    cam.setZoom(this.zoom);
    cam.roundPixels = true;
    cam.centerOn(this.cx, this.cy);
  }

  update(
    dt: number,
    leader: { x: number; y: number },
    pointerWorld: { x: number; y: number },
    unitCount: number,
  ): void {
    const c = this.cfg;
    const lx = clamp((pointerWorld.x - leader.x) * c.cursorLook, -c.cursorLookMax, c.cursorLookMax);
    const ly = clamp((pointerWorld.y - leader.y) * c.cursorLook, -c.cursorLookMax, c.cursorLookMax);
    const k = 1 - Math.exp(-c.followLerp * dt);
    this.cx = lerp(this.cx, leader.x + lx, k);
    this.cy = lerp(this.cy, leader.y + ly, k);

    let target = c.zoomSteps[0]?.zoom ?? 1;
    for (const s of c.zoomSteps) if (unitCount >= s.fromUnits) target = s.zoom;
    this.zoom = lerp(this.zoom, target, 1 - Math.exp(-c.zoomLerp * dt));
    this.cam.setZoom(this.zoom);
    this.cam.centerOn(this.cx, this.cy);
  }

  shake(durationMs: number, intensity: number): void {
    this.cam.shake(durationMs, intensity);
  }
}
