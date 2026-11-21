import type Phaser from 'phaser';
import { waveOutline } from '../sim/leader/WarriorSystem';
import type { Sim } from '../sim/Sim';

/** Снаряди: стріли і вогняні кулі. */
export class CombatView {
  private readonly g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, private readonly sim: Sim) {
    this.g = scene.add.graphics().setDepth(12);
  }

  draw(): void {
    const g = this.g;
    g.clear();
    // хвилі лідера: контур «U», що тоншає і гасне до кінця польоту
    for (const w of this.sim.warrior.waves) {
      const pts = waveOutline(w);
      const a = 1 - 0.7 * (w.traveled / w.range);
      g.lineStyle(3, 0xffffff, a).beginPath();
      pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
      g.lineStyle(1, 0xffd86b, a).beginPath();
      pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
    }
    for (const p of this.sim.combat.projectiles) {
      const len = Math.hypot(p.vx, p.vy) || 1;
      const nx = p.vx / len;
      const ny = p.vy / len;
      g.lineStyle(2, p.color, 1).lineBetween(p.x - nx * 5, p.y - ny * 5, p.x, p.y);
      g.fillStyle(0xffffff, 1).fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }
  }
}
