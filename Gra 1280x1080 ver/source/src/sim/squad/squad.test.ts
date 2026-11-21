import { describe, expect, it } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { Rng } from '../../core/Rng';
import { deg2rad, rad2deg, wrapAngle } from '../../core/math';
import { DEFAULT_SQUAD_CONFIG, type SquadConfig } from '../../data/squadConfig';
import { NEUTRAL_INTENT } from '../intent';
import { collideCircle } from '../world/colliders';
import { computeBounceHeading } from './bounce';
import { assignSlots, formationSlots } from './formation';
import { Squad } from './Squad';
import type { GameEvents } from '../events';

const cfg = (over: Partial<SquadConfig> = {}): SquadConfig => ({ ...DEFAULT_SQUAD_CONFIG, ...over });
const rng = () => new Rng(1);

function makeSquad(n: number, over: Partial<SquadConfig> = {}, solids: Squad['world']['solids'] = []) {
  const bus = new EventBus<GameEvents>();
  const events: { type: keyof GameEvents; payload: unknown }[] = [];
  (['bounce', 'dash', 'split', 'rejoin', 'holdExpired', 'unitDown', 'unitRevived', 'unitDied', 'gameOver'] as const).forEach((t) =>
    bus.on(t, (p) => events.push({ type: t, payload: p })),
  );
  const squad = new Squad(cfg(over), { width: 2000, height: 2000, solids }, bus, rng(), { x: 1000, y: 1000, heading: 0 });
  for (let i = 0; i < n; i++) squad.addUnit('knight');
  return { squad, events };
}

/** Стартовий хвіст уже лежить рівно по сліду позаду голови. */
function lineUp(squad: Squad) {
  squad.chain.forEach((u, i) => {
    expect(u.x).toBeCloseTo(squad.leader.x - (i + 1) * squad.cfg.unitSpacing, 3);
  });
}

describe('bounce', () => {
  const c = cfg();
  it('45° до стіни: кут падіння = куту відбиття', () => {
    // стіна зліва від кола: нормаль (1,0), голова летить вліво-вниз під 45° до стіни
    const h = computeBounceHeading(Math.PI + deg2rad(45), 1, 0, c, rng());
    expect(Math.cos(h)).toBeGreaterThan(0);
    expect(Math.abs(rad2deg(Math.asin(Math.abs(Math.sin(h)))))).toBeCloseTo(45, 3);
  });
  it('удар під 90°: вихід під ~15° до стіни, а не назад', () => {
    const h = computeBounceHeading(Math.PI, 1, 0, c, rng());
    const fromWall = rad2deg(Math.asin(Math.abs(Math.cos(h)))); // |вклад нормалі| = sin β
    expect(Math.abs(Math.cos(h))).toBeCloseTo(Math.sin(deg2rad(15)), 3);
    expect(fromWall).toBeCloseTo(15, 3);
  });
  it('ніколи не відскакує в себе: кут до зворотного напрямку ≥ 60° для будь-якого α', () => {
    for (let a = 0; a <= 90; a += 1) {
      const heading = Math.PI + deg2rad(a); // α = кут до поверхні стіни
      const out = computeBounceHeading(heading, 1, 0, c, rng());
      const back = wrapAngle(heading + Math.PI); // «у свій хвіст»
      const diff = Math.abs(wrapAngle(out - back));
      if (a > 5) expect(rad2deg(diff)).toBeGreaterThanOrEqual(60);
    }
  });
  it('сторону визначає бік заходу: зайшов зверху — виходить униз-вправо і навпаки', () => {
    const slightlyUp = computeBounceHeading(Math.PI - deg2rad(5), 1, 0, c, rng());
    const slightlyDown = computeBounceHeading(Math.PI + deg2rad(5), 1, 0, c, rng());
    expect(Math.sign(Math.sin(slightlyUp))).toBe(Math.sign(Math.sin(Math.PI - deg2rad(5))));
    expect(Math.sign(Math.sin(slightlyDown))).toBe(Math.sign(Math.sin(Math.PI + deg2rad(5))));
  });
  it('голова в світі реально відбивається від стіни і не застрягає', () => {
    const { squad, events } = makeSquad(0, {}, [{ kind: 'rect', x: 1100, y: 0, w: 50, h: 2000 }]);
    for (let i = 0; i < 240; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    expect(events.some((e) => e.type === 'bounce')).toBe(true);
    expect(collideCircle(squad.world.solids, squad.leader.x, squad.leader.y, squad.cfg.leaderRadius)).toBeNull();
    expect(Math.cos(squad.leader.heading)).toBeLessThan(0.99);
  });
});

describe('formation', () => {
  it('3 — трикутник, 4 — ромб: сусіди на відстані spacing', () => {
    for (const n of [3, 4, 5, 8]) {
      const s = formationSlots(n, 20);
      for (let i = 0; i < n; i++) {
        const a = s[i]!;
        const b = s[(i + 1) % n]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(20, 5);
      }
    }
    const diamond = formationSlots(4, 20);
    expect(diamond[0]!.x).toBeCloseTo(0, 5); // вершина вгору
    expect(diamond[0]!.y).toBeLessThan(0);
  });
  it('призначення слотів зберігає цикл і мінімізує шлях', () => {
    const slots = formationSlots(4, 20);
    const pos = slots.map((s) => ({ x: 100 + s.x, y: 100 + s.y }));
    expect(assignSlots(pos, slots, 100, 100)).toEqual([0, 1, 2, 3]);
  });
});

describe('split / rejoin', () => {
  it('відкус між 4-м і 5-м котом відчіплює решту', () => {
    const { squad, events } = makeSquad(8);
    lineUp(squad);
    const a = squad.chain[3]!;
    const b = squad.chain[4]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    expect(squad.chain.length).toBe(4);
    expect(squad.groups[0]!.units.length).toBe(4);
    expect(events.find((e) => e.type === 'split')).toBeDefined();
  });
  it('перші 4 коти відчепити не можна', () => {
    const { squad } = makeSquad(8);
    lineUp(squad);
    const a = squad.chain[1]!;
    const b = squad.chain[2]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    expect(squad.groups.length).toBe(0);
    expect(squad.chain.length).toBe(8);
  });
  it('дотик до кінчика останнього кота — не Split', () => {
    const { squad } = makeSquad(8);
    lineUp(squad);
    const last = squad.chain[7]!;
    squad.leader.x = last.x - 9;
    squad.leader.y = last.y;
    squad.checkSplit();
    expect(squad.groups.length).toBe(0);
  });
  it('відкус другої ланки хвоста від кінця: відчіплюється один кіт', () => {
    const { squad } = makeSquad(8);
    lineUp(squad);
    const a = squad.chain[6]!;
    const b = squad.chain[7]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    expect(squad.groups[0]!.units.length).toBe(1);
  });
  it('відчеплені коти стають фігурою на місці, а потім гинуть після holdDuration', () => {
    const { squad, events } = makeSquad(9, { holdDuration: 2 });
    lineUp(squad);
    const a = squad.chain[3]!;
    const b = squad.chain[4]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    const g = squad.groups[0]!;
    squad.leader.x = 0;
    squad.leader.y = 0; // голова далеко
    for (let i = 0; i < 100; i++) squad.update(1 / 120, { ...NEUTRAL_INTENT });
    const n = g.units.length;
    const r = squad.cfg.unitSpacing * squad.cfg.holdSpacingMult / (2 * Math.sin(Math.PI / n));
    for (const u of g.units) expect(Math.hypot(u.x - g.cx, u.y - g.cy)).toBeCloseTo(r, 0);
    for (let i = 0; i < 240; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    expect(squad.groups.length).toBe(0);
    expect(events.some((e) => e.type === 'holdExpired')).toBe(true);
  });
  it('пересборка: голова торкається групи — група в кінець хвоста, порядок збережено', () => {
    const { squad, events } = makeSquad(8);
    lineUp(squad);
    const ids = squad.chain.map((u) => u.id);
    const a = squad.chain[3]!;
    const b = squad.chain[4]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    const g = squad.groups[0]!;
    g.age = 10; // повз grace
    squad.leader.x = g.units[0]!.x;
    squad.leader.y = g.units[0]!.y;
    squad.checkRejoin();
    expect(squad.groups.length).toBe(0);
    expect(squad.chain.map((u) => u.id)).toEqual(ids);
    expect(events.some((e) => e.type === 'rejoin')).toBe(true);
  });
  it('одразу після відкусу пересборка заблокована (grace)', () => {
    const { squad } = makeSquad(8);
    lineUp(squad);
    const a = squad.chain[3]!;
    const b = squad.chain[4]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    squad.checkRejoin();
    expect(squad.groups.length).toBe(1);
  });
});

describe('хвіст — велосипедний ланцюг', () => {
  const turn = { ...NEUTRAL_INTENT, turnAxis: 1 };
  it('крок між ланками жорсткий: на прямій і в тісному повороті', () => {
    const { squad } = makeSquad(10, { splitFirstDetachableIndex: 99 });
    let maxErr = 0;
    for (let i = 0; i < 1200; i++) {
      squad.update(1 / 120, i % 600 < 300 ? turn : NEUTRAL_INTENT);
      let prev: { x: number; y: number } = squad.leader;
      for (const u of squad.chain) {
        maxErr = Math.max(maxErr, Math.abs(Math.hypot(prev.x - u.x, prev.y - u.y) - squad.cfg.unitSpacing));
        prev = u;
      }
    }
    expect(maxErr).toBeLessThan(0.5);
  });
  it('кожна ланка йде точно по сліду голови, не зрізає кути', () => {
    const { squad } = makeSquad(10, { splitFirstDetachableIndex: 99 });
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < 900; i++) {
      squad.update(1 / 120, i < 450 ? turn : NEUTRAL_INTENT);
      path.push({ x: squad.leader.x, y: squad.leader.y });
    }
    // фінальний кіт хвоста лежить на траєкторії голови (полілінія з кроком ≈1px)
    const last = squad.chain[squad.chain.length - 1]!;
    const nearest = Math.min(...path.map((p) => Math.hypot(p.x - last.x, p.y - last.y)));
    expect(nearest).toBeLessThan(1.2);
  });
  it('ривок не розтягує ланцюг', () => {
    const { squad } = makeSquad(10);
    squad.update(1 / 120, { ...NEUTRAL_INTENT, dash: true });
    for (let i = 0; i < 60; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    let prev: { x: number; y: number } = squad.leader;
    for (const u of squad.chain) {
      expect(Math.abs(Math.hypot(prev.x - u.x, prev.y - u.y) - squad.cfg.unitSpacing)).toBeLessThan(0.6);
      prev = u;
    }
  });
  it('ривок: множник швидкості, невразливість, перезарядка', () => {
    const { squad } = makeSquad(0);
    squad.update(1 / 120, { ...NEUTRAL_INTENT, dash: true });
    expect(squad.invulnerable).toBe(true);
    expect(squad.leader.speed).toBeCloseTo(squad.cfg.leaderSpeed * squad.cfg.dashSpeedMult);
    for (let i = 0; i < 60; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    expect(squad.invulnerable).toBe(false);
    expect(squad.leader.dashCooldownLeft).toBeGreaterThan(2);
  });
});

describe('режим «кожен за попереднім»', () => {
  const turn = { ...NEUTRAL_INTENT, turnAxis: 1 };
  const run = (mode: 'trail' | 'pursuit') => {
    const { squad } = makeSquad(10, { splitFirstDetachableIndex: 99 });
    squad.chainMode = mode;
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < 450; i++) {
      squad.update(1 / 120, turn); // меряємо відхилення, поки голова ще крутиться
      path.push({ x: squad.leader.x, y: squad.leader.y });
    }
    const last = squad.chain[squad.chain.length - 1]!;
    return { squad, off: Math.min(...path.map((p) => Math.hypot(p.x - last.x, p.y - last.y))) };
  };
  it('тримає крок між ланками, але зрізає кути (сходить зі сліду голови)', () => {
    const pursuit = run('pursuit');
    let prev: { x: number; y: number } = pursuit.squad.leader;
    for (const u of pursuit.squad.chain) {
      expect(Math.abs(Math.hypot(prev.x - u.x, prev.y - u.y) - pursuit.squad.cfg.unitSpacing)).toBeLessThan(0.5);
      prev = u;
    }
    expect(pursuit.off).toBeGreaterThan(run('trail').off + 1);
  });
  it('перемикання на льоту не рве ланцюг', () => {
    const { squad } = makeSquad(10, { splitFirstDetachableIndex: 99 });
    for (let i = 0; i < 300; i++) squad.update(1 / 120, turn);
    squad.chainMode = 'pursuit';
    for (let i = 0; i < 300; i++) squad.update(1 / 120, turn);
    squad.chainMode = 'trail';
    for (let i = 0; i < 600; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    let prev: { x: number; y: number } = squad.leader;
    for (const u of squad.chain) {
      expect(Math.abs(Math.hypot(prev.x - u.x, prev.y - u.y) - squad.cfg.unitSpacing)).toBeLessThan(0.6);
      prev = u;
    }
  });
});

describe('падіння і підйом', () => {
  const kill = (squad: Squad, i: number) => {
    const u = squad.chain[i]!;
    squad.damageUnit(u, 99999);
    return u;
  };
  it('кіт на 0 HP вилітає з хвоста, ланцюг зімкнувся без щілини', () => {
    const { squad, events } = makeSquad(8);
    kill(squad, 3);
    expect(squad.chain.length).toBe(7);
    expect(squad.fallen.length).toBe(1);
    expect(squad.fallen[0]!.downTimeLeft).toBe(10);
    expect(events.some((e) => e.type === 'unitDown')).toBe(true);
    for (let i = 0; i < 120; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    let prev: { x: number; y: number } = squad.leader;
    for (const u of squad.chain) {
      expect(Math.abs(Math.hypot(prev.x - u.x, prev.y - u.y) - squad.cfg.unitSpacing)).toBeLessThan(0.6);
      prev = u;
    }
  });
  it('впалий нічого не робить, а торкнувшись головою — стає в кінець хвоста з мінімумом HP', () => {
    const { squad, events } = makeSquad(8);
    const u = kill(squad, 2);
    squad.leader.x = u.x;
    squad.leader.y = u.y;
    squad.update(1 / 120, NEUTRAL_INTENT);
    expect(squad.fallen.length).toBe(0);
    expect(squad.chain[squad.chain.length - 1]).toBe(u);
    expect(u.hp).toBe(Math.round(u.maxHp * squad.cfg.reviveHpFraction));
    expect(u.mode).toBe('chain');
    expect(events.some((e) => e.type === 'unitRevived')).toBe(true);
  });
  it('таймери підйому коротшають з кожним падінням: 10 → 7 → 5 → 3, потім смерть', () => {
    const { squad, events } = makeSquad(6);
    const u = squad.chain[2]!;
    const timers: number[] = [];
    for (let n = 0; n < 4; n++) {
      squad.damageUnit(u, 99999);
      timers.push(u.downTimeLeft);
      squad.leader.x = u.x;
      squad.leader.y = u.y;
      squad.update(1 / 120, NEUTRAL_INTENT);
    }
    expect(timers).toEqual([10, 7, 5, 3]);
    squad.damageUnit(u, 99999);
    expect(events.some((e) => e.type === 'unitDied')).toBe(true);
    expect(squad.fallen.length).toBe(0);
  });
  it('не підібраний вчасно — гине назавжди', () => {
    const { squad, events } = makeSquad(6);
    kill(squad, 2);
    squad.leader.x = -500; // далеко
    squad.leader.y = -500;
    for (let i = 0; i < 120 * 11; i++) squad.update(1 / 120, NEUTRAL_INTENT);
    expect(squad.fallen.length).toBe(0);
    expect(events.some((e) => e.type === 'unitDied')).toBe(true);
  });
  it('падіння у відчепленій групі: кіт лежить окремо, група дальше стоїть, порожня група зникає', () => {
    const { squad } = makeSquad(6);
    const a = squad.chain[3]!;
    const b = squad.chain[4]!;
    squad.leader.x = (a.x + b.x) / 2;
    squad.leader.y = a.y;
    squad.checkSplit();
    const g = squad.groups[0]!;
    const n = g.units.length;
    squad.damageUnit(g.units[0]!, 99999);
    expect(g.units.length).toBe(n - 1);
    expect(squad.fallen.length).toBe(1);
    for (const u of [...g.units]) squad.damageUnit(u, 99999);
    expect(squad.groups.length).toBe(0);
    expect(squad.fallen.length).toBe(n);
  });
  it('лідер на 0 HP — кінець експедиції; під ривком невразливий', () => {
    const { squad, events } = makeSquad(2);
    squad.leader.dashTimeLeft = 0.3;
    expect(squad.damageLeader(50)).toBe(false);
    squad.leader.dashTimeLeft = 0;
    squad.damageLeader(99999);
    expect(squad.leader.dead).toBe(true);
    expect(events.some((e) => e.type === 'gameOver')).toBe(true);
  });
});
