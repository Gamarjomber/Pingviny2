import Phaser from 'phaser';
import { ENEMY_DEFS } from '../data/enemies';
import { spriteFrames, spriteKey } from '../data/spriteAssets';
import type { Sim } from '../sim/Sim';

/** Спрайти ворогів (16×16, пул за id) і телеграф ривка. Лише читає стан симуляції. */
export class EnemyView {
  private readonly images = new Map<number, Phaser.GameObjects.Image>();
  private readonly tele: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, private readonly sim: Sim) {
    this.tele = scene.add.graphics().setDepth(9);
  }

  draw(): void {
    const seen = new Set<number>();
    this.tele.clear();
    for (const e of this.sim.enemies.list) {
      if (e.dead) continue;
      seen.add(e.id);
      let img = this.images.get(e.id);
      if (!img) {
        const sprite = ENEMY_DEFS[e.defId]?.sprite;
        img = sprite && spriteFrames(this.scene, sprite) > 0 ? this.scene.add.image(0, 0, spriteKey(sprite, 0)) : this.scene.add.image(0, 0, `enemy_${e.defId}`, 0);
        img.setData('sprite', sprite ?? null);
        this.images.set(e.id, img);
      }
      const sprite = img.getData('sprite') as string | null;
      if (sprite && img.texture.key.startsWith('spr_')) {
        const n = spriteFrames(this.scene, sprite);
        img.setTexture(spriteKey(sprite, Math.floor(e.anim * 7) % n));
      } else {
        img.setFrame(Math.floor(e.anim * 7) % 2);
      }
      img.setPosition(Math.round(e.x), Math.round(e.y));
      img.setFlipX(e.faceX < 0);
      img.setDepth(8 + e.y / 100000);
      if (e.flash > 0) {
        img.tintMode = Phaser.TintModes.FILL;
        img.setTint(0xffffff);
      } else {
        img.tintMode = Phaser.TintModes.MULTIPLY;
        if (e.state === 'windup') img.setTint(0xff7070);
        else img.clearTint();
      }

      // Telegraph: перед ривком показуємо лінію удару
      if (e.state === 'windup') {
        const def = ENEMY_DEFS[e.defId]!;
        const l = def.lunge!;
        const len = def.speed * l.speedMult * l.duration;
        const k = e.stateTime / l.windup;
        this.tele.lineStyle(2, 0xff4040, 0.35 + 0.5 * k);
        this.tele.lineBetween(e.x, e.y, e.x + e.dirx * len, e.y + e.diry * len);
        this.tele.fillStyle(0xff4040, 0.9).fillRect(Math.round(e.x) - 1, Math.round(e.y) - 14, 2, 5);
        this.tele.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 7, 2, 2);
      }
    }
    for (const [id, img] of this.images) {
      if (!seen.has(id)) {
        img.destroy();
        this.images.delete(id);
      }
    }
  }

  clear(): void {
    for (const img of this.images.values()) img.destroy();
    this.images.clear();
  }
}
