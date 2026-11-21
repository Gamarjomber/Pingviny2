import Phaser from 'phaser';
import { Rng } from '../core/Rng';
import type { ArenaDef } from '../data/arena';

export const FLOOR_KEY = 'floor';

/** Генерує піксельну текстуру підлоги (тимчасова заміна арту біому). */
export function ensureFloorTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(FLOOR_KEY)) return;
  const size = 32;
  const tex = scene.textures.createCanvas(FLOOR_KEY, size, size)!;
  const ctx = tex.getContext();
  const rng = new Rng(7);
  ctx.fillStyle = '#1d1526';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rng.range(0, size));
    const y = Math.floor(rng.range(0, size));
    ctx.fillStyle = rng.next() < 0.5 ? '#251c30' : '#171021';
    ctx.fillRect(x, y, rng.next() < 0.3 ? 3 : 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#2b3a2a';
    ctx.fillRect(Math.floor(rng.range(1, size - 2)), Math.floor(rng.range(1, size - 3)), 1, 2);
  }
  tex.refresh();
}

/** Малює підлогу й перешкоди арени. Статичний шар, будується один раз. */
export function buildWorldView(scene: Phaser.Scene, arena: ArenaDef): void {
  ensureFloorTexture(scene);
  scene.add.tileSprite(0, 0, arena.width, arena.height, FLOOR_KEY).setOrigin(0, 0).setDepth(0);
  const g = scene.add.graphics().setDepth(5);
  for (const s of arena.solids) {
    if (s.kind === 'rect') {
      g.fillStyle(0x0b0710, 1).fillRect(s.x, s.y, s.w, s.h);
      const inside = s.x >= 0 && s.y >= 0 && s.x + s.w <= arena.width && s.y + s.h <= arena.height;
      if (inside) {
        g.fillStyle(0x6e6378, 1).fillRect(s.x, s.y, s.w, s.h);
        g.fillStyle(0x8b7f96, 1).fillRect(s.x, s.y, s.w, 3);
        g.fillStyle(0x4d4458, 1).fillRect(s.x, s.y + s.h - 3, s.w, 3);
      }
    } else {
      g.fillStyle(0x4d4458, 1).fillCircle(s.x, s.y, s.r);
      g.fillStyle(0x6e6378, 1).fillCircle(s.x - 2, s.y - 3, s.r - 4);
      g.fillStyle(0x8b7f96, 1).fillCircle(s.x - 5, s.y - 7, Math.max(3, s.r * 0.35));
    }
  }
  // рамка поля
  g.lineStyle(2, 0x3a2f4a, 1).strokeRect(0, 0, arena.width, arena.height);
}
