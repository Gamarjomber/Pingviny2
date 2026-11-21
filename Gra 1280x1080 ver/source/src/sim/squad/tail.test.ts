import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { Rng } from '../../core/Rng';
import { DEFAULT_SQUAD_CONFIG, type SquadConfig } from '../../data/squadConfig';
import type { GameEvents } from '../events';
import { collideCircle, type Solid } from '../world/colliders';
import { Squad } from './Squad';

/** Критерії «ГОТОВО КОЛИ» для руху хвоста. Числа друкуються — це і звіт. */
const make = (n: number, solids: Solid[] = [], over: Partial<SquadConfig> = {}, spawn = { x: 1000, y: 1000, heading: 0 }) => {
  const bus = new EventBus<GameEvents>();
  const squad = new Squad({ ...DEFAULT_SQUAD_CONFIG, splitFirstDetachableIndex: 99, ...over }, { width: 2000, height: 2000, solids }, bus, new Rng(1), spawn);
  for (let i = 0; i < n; i++) squad.addUnit('knight');
  return squad;
};
const run = (squad: Squad, seconds: number, fps: number, intentAt: (t: number, s: Squad) => number | null) => {
  const dt = 1 / fps;
  const steps = Math.round(seconds * fps);
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    squad.update(dt, { targetAngle: intentAt(t, squad), turnAxis: 0, dash: false, brake: false });
  }
};
const shape = (s: Squad) => s.chain.map((u) => [u.x - s.leader.x, u.y - s.leader.y] as const);

describe('хвіст: критерії', () => {
  it('1. зиґзаґ головою: хвіст плавний і не зупиняється', () => {
    const s = make(20);
    let minSpeed = Infinity;
    let maxTurnPerLink = 0;
    const prev = s.chain.map((u) => ({ x: u.x, y: u.y }));
    const dt = 1 / 120;
    for (let i = 0; i < 120 * 6; i++) {
      const t = i * dt;
      s.update(dt, { targetAngle: Math.sin(t * 9) * 1.4, turnAxis: 0, dash: false, brake: false });
      if (t > 1) {
        const last = s.chain[19]!;
        minSpeed = Math.min(minSpeed, Math.hypot(last.x - prev[19]!.x, last.y - prev[19]!.y) / dt);
      }
      s.chain.forEach((u, k) => ((prev[k]!.x = u.x), (prev[k]!.y = u.y)));
    }
    for (let i = 1; i < 19; i++) {
      const a = s.chain[i - 1]!, b = s.chain[i]!, c = s.chain[i + 1]!;
      const d = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
      maxTurnPerLink = Math.max(maxTurnPerLink, Math.min(d, 2 * Math.PI - d));
    }
    console.log(`[1] мін. швидкість останнього кота: ${minSpeed.toFixed(1)} px/с (голова ${s.leader.speed}); макс. злам на ланці: ${((maxTurnPerLink * 180) / Math.PI).toFixed(1)}°`);
    expect(minSpeed).toBeGreaterThan(s.leader.speed * 0.5);
    expect(maxTurnPerLink).toBeLessThan(Math.PI / 2);
  });

  it('2. відбій 90° від стіни: хвіст по дузі, жоден кіт не в стіні', () => {
    const wall: Solid = { kind: 'rect', x: 1300, y: 0, w: 100, h: 2000 };
    const s = make(20, [wall]);
    let maxPen = 0;
    const dt = 1 / 120;
    for (let i = 0; i < 120 * 6; i++) {
      s.update(dt, { targetAngle: 0, turnAxis: 0, dash: false, brake: false });
      for (const u of s.chain) {
        const c = collideCircle([wall], u.x, u.y, s.cfg.unitRadius);
        if (c) maxPen = Math.max(maxPen, c.depth);
      }
    }
    console.log(`[2] макс. проникнення кота в стіну: ${maxPen.toFixed(2)} px; виштовхувань: ${s.railWallPushes}; охорона пера: ${s.penGuardHits}`);
    expect(maxPen).toBeLessThan(1);
  });

  it('3. 20 котів: однакова форма на 30 і 144 FPS', () => {
    const f = (fps: number) => {
      const s = make(20);
      run(s, 3, fps, (t) => (t < 1.5 ? 0 : 1.2 * Math.sin((t - 1.5) * 2)));
      return s;
    };
    const a = f(30), b = f(144);
    // порівнюємо форму в системі координат голови
    const sa = shape(a), sb = shape(b);
    let maxD = 0;
    for (let i = 0; i < sa.length; i++) maxD = Math.max(maxD, Math.hypot(sa[i]![0] - sb[i]![0], sa[i]![1] - sb[i]![1]));
    console.log(`[3] макс. розбіжність позицій 30 vs 144 FPS: ${maxD.toFixed(2)} px (SPACING ${a.cfg.unitSpacing})`);
    expect(maxD).toBeLessThan(a.cfg.unitSpacing * 1.5);
  });

  it('4. петлі в хвості лише якщо голова робила петлю', () => {
    const s = make(20);
    run(s, 4, 120, () => 0);
    const straight = s.chain.every((u, i) => Math.abs(u.y - s.leader.y) < 0.5 && i >= 0);
    console.log(`[4] пряма: усі коти на одній лінії з головою: ${straight}`);
    expect(straight).toBe(true);
    // зиґзаґ без петель: хвіст не перетинає сам себе
    const z = make(20);
    run(z, 5, 120, (t) => Math.sin(t * 3) * 0.9);
    let crossings = 0;
    for (let i = 0; i < 19; i++)
      for (let j = i + 2; j < 19; j++) {
        const A = z.chain[i]!, B = z.chain[i + 1]!, C = z.chain[j]!, D = z.chain[j + 1]!;
        const o = (p: any, q: any, r: any) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
        if (o(A, B, C) !== o(A, B, D) && o(C, D, A) !== o(C, D, B)) crossings++;
      }
    console.log(`[4] самоперетини при зиґзаґу без петель: ${crossings}`);
    expect(crossings).toBe(0);
  });

  it('5. ідеальне коло не втримати: спіраль', () => {
    const s = make(20);
    // тримаємо максимальний поворот вліво
    const dt = 1 / 120;
    const radii: number[] = [];
    let cx = 0, cy = 0, n = 0;
    for (let i = 0; i < 120 * 12; i++) {
      s.update(dt, { targetAngle: null, turnAxis: -1, dash: false, brake: false });
      if (i % 120 === 119) {
        // оцінка радіуса: відстань до центру кривизни = speed / yawRate
        const h0 = s.leader.heading;
        radii.push(s.minTurnRadius());
        void h0; void cx; void cy; void n;
      }
    }
    console.log(`[5] мін. радіус розвороту по секундах: ${radii.map((r) => r.toFixed(1)).join(', ')}`);
    expect(radii[radii.length - 1]!).toBeGreaterThan(radii[0]! * 1.5);
    // і справді віддаляється від початку кола
    const loop = make(20);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 120 * 12; i++) {
      loop.update(dt, { targetAngle: null, turnAxis: -1, dash: false, brake: false });
      if (i % 12 === 0) pts.push({ x: loop.leader.x, y: loop.leader.y });
    }
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    const rFirst = dist(pts[0]!, pts[Math.floor(pts.length / 12 * 0.5)]!);
    const rLast = Math.max(...pts.slice(-20).map((p) => dist(p, pts[pts.length - 1]!)));
    console.log(`[5] діаметр першого оберту ~${rFirst.toFixed(1)} px, діаметр останніх ~${rLast.toFixed(1)} px`);
    expect(rLast).toBeGreaterThan(rFirst * 1.3);
  });

  it('6. Split і Rejoin працюють як раніше', () => {
    const bus = new EventBus<GameEvents>();
    const types: string[] = [];
    (['split', 'rejoin'] as const).forEach((t) => bus.on(t, () => types.push(t)));
    const s = new Squad({ ...DEFAULT_SQUAD_CONFIG }, { width: 3000, height: 3000, solids: [] }, bus, new Rng(1), { x: 1000, y: 1000, heading: 0 });
    for (let i = 0; i < 12; i++) s.addUnit('knight');
    // великий розворот: голова торкається ланки хвоста
    const dt = 1 / 120;
    for (let i = 0; i < 120 * 40 && !types.includes('split'); i++) s.update(dt, { targetAngle: null, turnAxis: -1, dash: false, brake: false });
    console.log(`[6] події: ${types.join(',') || 'немає'}; у групах: ${s.groups.reduce((a, g) => a + g.units.length, 0)}, у хвості: ${s.chain.length}`);
    expect(types).toContain('split');
    for (let i = 0; i < 120 * 40 && !types.includes('rejoin'); i++) {
      const g = s.groups[0];
      s.update(dt, { targetAngle: g ? Math.atan2(g.cy - s.leader.y, g.cx - s.leader.x) : null, turnAxis: 0, dash: false, brake: false });
    }
    console.log(`[6] після: ${types.join(',')}; хвіст ${s.chain.length}`);
    expect(types).toContain('rejoin');
  });
});
