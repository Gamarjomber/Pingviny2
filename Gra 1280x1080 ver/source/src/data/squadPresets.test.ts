import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import type { GameEvents } from '../sim/events';
import { Squad } from '../sim/squad/Squad';
import { collideCircle, type Solid } from '../sim/world/colliders';
import { DEFAULT_SQUAD_CONFIG, SQUAD_TUNABLES } from './squadConfig';
import { SQUAD_PRESETS } from './squadPresets';

describe('пресети налаштувань', () => {
  it('усі значення пресетів лежать у межах слайдерів', () => {
    for (const pr of SQUAD_PRESETS) {
      for (const t of SQUAD_TUNABLES) {
        const v = pr.values[t.key];
        if (v === undefined) continue;
        expect(v, `${pr.name}.${t.key}`).toBeGreaterThanOrEqual(t.min);
        expect(v, `${pr.name}.${t.key}`).toBeLessThanOrEqual(t.max);
      }
    }
  });
  it('рівно один рекомендований, id унікальні', () => {
    expect(SQUAD_PRESETS.filter((p) => p.recommended).length).toBe(1);
    expect(new Set(SQUAD_PRESETS.map((p) => p.id)).size).toBe(SQUAD_PRESETS.length);
  });
  for (const pr of SQUAD_PRESETS) {
    it(`«${pr.name}»: зиґзаґ і стіна — хвіст рухається, коти не в стіні`, () => {
      const wall: Solid = { kind: 'rect', x: 1400, y: 0, w: 100, h: 2000 };
      const cfg = { ...DEFAULT_SQUAD_CONFIG, ...pr.values, splitFirstDetachableIndex: 99 };
      const s = new Squad(cfg, { width: 2000, height: 2000, solids: [wall] }, new EventBus<GameEvents>(), new Rng(1), { x: 1000, y: 1000, heading: 0 });
      for (let i = 0; i < 20; i++) s.addUnit('knight');
      const dt = 1 / 120;
      let maxPen = 0;
      let moved = 0;
      let last = { x: s.chain[19]!.x, y: s.chain[19]!.y };
      for (let i = 0; i < 120 * 8; i++) {
        s.update(dt, { targetAngle: Math.sin(i * dt * 4) * 1.2, turnAxis: 0, dash: false, brake: false });
        for (const u of s.chain) {
          const c = collideCircle([wall], u.x, u.y, cfg.unitRadius);
          if (c) maxPen = Math.max(maxPen, c.depth);
        }
        moved += Math.hypot(s.chain[19]!.x - last.x, s.chain[19]!.y - last.y);
        last = { x: s.chain[19]!.x, y: s.chain[19]!.y };
      }
      console.log(`[пресет ${pr.name}] хвіст пройшов ${moved.toFixed(0)} px за 8 с, макс. проникнення в стіну ${maxPen.toFixed(2)} px`);
      expect(maxPen).toBeLessThan(1);
      expect(moved).toBeGreaterThan(cfg.leaderSpeed * 8 * 0.5);
    });
  }
});
