import { describe, expect, it } from 'vitest';
import { DEFAULT_SQUAD_CONFIG, type SquadConfig } from '../data/squadConfig';
import type { GameEvents } from './events';
import { NEUTRAL_INTENT, type SteerIntent } from './intent';
import { Sim } from './Sim';

const arena = { width: 4000, height: 4000, solids: [], spawn: { x: 2000, y: 2000, heading: 0 } };
const F: SteerIntent = { ...NEUTRAL_INTENT, ability: true };

function makeSim(cats: number, over: Partial<SquadConfig> = {}) {
  const sim = new Sim({ ...DEFAULT_SQUAD_CONFIG, leaderSpeed: 1, splitFirstDetachableIndex: 99, ...over }, arena, 1);
  sim.autoSpawn = false;
  for (let i = 0; i < cats; i++) sim.squad.addUnit('knight');
  const events: { type: keyof GameEvents; payload: unknown }[] = [];
  (['leaderSlash', 'abilityStart', 'abilityEnd', 'blocked', 'ringClosed', 'split'] as const).forEach((t) =>
    sim.bus.on(t, (p) => events.push({ type: t, payload: p })),
  );
  return { sim, events };
}
const tick = (sim: Sim, sec: number, intent: SteerIntent = NEUTRAL_INTENT) => {
  for (let i = 0; i < Math.round(sec * 120); i++) sim.update(1 / 120, intent);
};

describe('Воїн: атака хвилею «U»', () => {
  it('хвиля летить у найближчого ворога, навіть якщо він за спиною', () => {
    const { sim } = makeSim(0);
    sim.squad.godMode = true;
    const l = sim.squad.leader; // дивиться вправо
    const back = sim.enemies.spawn('rat', l.x - 40, l.y)!;
    back.slowMult = 0; back.slowTime = 1e6;
    tick(sim, 1);
    expect(back.hp).toBeLessThan(back.maxHp);
  });
  it('б\'є найближчого, а не першого-ліпшого; ворог поза дальністю хвилі не зачіпається', () => {
    const { sim } = makeSim(0);
    sim.squad.godMode = true;
    const l = sim.squad.leader;
    const far = sim.enemies.spawn('rat', l.x + 200, l.y)!;
    far.slowMult = 0; far.slowTime = 1e6;
    tick(sim, 1);
    expect(far.hp).toBe(far.maxHp);
  });
  it('хвиля вузька й довга: ворог збоку від траєкторії не зачіпається, на траєкторії — так', () => {
    const { sim } = makeSim(0);
    sim.squad.godMode = true;
    const l = sim.squad.leader;
    const target = sim.enemies.spawn('rat', l.x + 60, l.y)!;
    const aside = sim.enemies.spawn('rat', l.x + 70, l.y + 30)!; // за межами ширини «U»
    for (const e of [target, aside]) { e.slowMult = 0; e.slowTime = 1e6; }
    tick(sim, 0.6);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(aside.hp).toBe(aside.maxHp);
  });
  it('хвиля пробиває і зачіпає кожного ворога лише раз за політ', () => {
    const { sim } = makeSim(0, { warriorWaveInterval: 99 }); // лише перша хвиля
    sim.squad.godMode = true;
    const l = sim.squad.leader;
    const a = sim.enemies.spawn('rat', l.x + 30, l.y)!;
    const b = sim.enemies.spawn('rat', l.x + 55, l.y)!;
    for (const e of [a, b]) { e.slowMult = 0; e.slowTime = 1e6; e.hp = e.maxHp = 1000; }
    tick(sim, 1);
    const dmg = sim.cfg.warriorWaveDamage;
    expect(a.maxHp - a.hp).toBeGreaterThan(0);
    expect(b.maxHp - b.hp).toBeGreaterThan(0);
    expect(a.maxHp - a.hp).toBeLessThanOrEqual(dmg * 2.5); // один удар (з можливим критом), не багато
  });
  it('активка збільшує дальність: ворог поза базовою дальністю б\'ється лише під активкою', () => {
    const { sim } = makeSim(0);
    sim.squad.godMode = true;
    const l = sim.squad.leader;
    const far = sim.enemies.spawn('rat', l.x + 110, l.y)!;
    far.slowMult = 0; far.slowTime = 1e6;
    tick(sim, 0.5);
    expect(far.hp).toBe(far.maxHp);
    sim.update(1 / 120, F);
    tick(sim, 1);
    expect(far.hp).toBeLessThan(far.maxHp);
  });
  it('перезарядка хвилі: без ворогів кд не тратиться', () => {
    const { sim, events } = makeSim(0);
    tick(sim, 2);
    expect(events.filter((e) => e.type === 'leaderSlash').length).toBe(0);
  });
});

describe('Воїн: активка', () => {
  it('сповільнює ворогів, дає передній щит і бафф; потім усе знімається, і йде перезарядка', () => {
    const { sim, events } = makeSim(2);
    const l = sim.squad.leader;
    const rat = sim.enemies.spawn('rat', l.x + 80, l.y + 5)!;
    sim.update(1 / 120, F);
    expect(events.some((e) => e.type === 'abilityStart')).toBe(true);
    sim.update(1 / 120, NEUTRAL_INTENT);
    expect(rat.slowTime).toBeGreaterThan(0);
    expect(rat.slowMult).toBe(sim.cfg.warriorSlowMult);
    expect(sim.squad.frontGuardHalfArc).toBeGreaterThan(0);
    expect(sim.squad.modifiers.get('damage')).toBeCloseTo(sim.cfg.warriorTeamDamageMult);
    expect(sim.squad.modifiers.get('critMult')).toBeCloseTo(sim.cfg.warriorTeamCritMult);
    tick(sim, sim.cfg.warriorAbilityDuration + 0.1);
    expect(events.some((e) => e.type === 'abilityEnd')).toBe(true);
    expect(sim.squad.frontGuardHalfArc).toBe(0);
    expect(sim.squad.modifiers.get('damage')).toBe(1);
    expect(sim.warrior.abilityCooldownLeft).toBeGreaterThan(0);
    // повторне натискання під час кд нічого не робить
    const starts = events.filter((e) => e.type === 'abilityStart').length;
    sim.update(1 / 120, F);
    expect(events.filter((e) => e.type === 'abilityStart').length).toBe(starts);
  });
  it('щит блокує удар спереду повністю, але не ззаду', () => {
    const { sim } = makeSim(0);
    const l = sim.squad.leader;
    sim.update(1 / 120, F);
    sim.update(1 / 120, NEUTRAL_INTENT);
    const hp = l.hp;
    expect(sim.squad.damageLeader(30, l.x + 10, l.y)).toBe(true);
    expect(l.hp).toBe(hp);
    sim.squad.damageLeader(30, l.x - 10, l.y);
    expect(l.hp).toBe(hp - 30);
  });
  it('команда б\'є сильніше під баффом (середній урон лицаря росте)', () => {
    const avg = (buff: boolean) => {
      let total = 0;
      for (let seed = 0; seed < 1; seed++) {
        const { sim } = makeSim(1, { warriorWaveDamage: 0.0001 });
        if (buff) sim.update(1 / 120, F);
        const u = sim.squad.chain[0]!;
        const dummy = sim.enemies.spawn('rat', u.x - 14, u.y)!;
        dummy.hp = dummy.maxHp = 1e6;
        dummy.slowMult = 0; dummy.slowTime = 1e6;
        tick(sim, 5);
        total += dummy.maxHp - dummy.hp;
      }
      return total;
    };
    expect(avg(true)).toBeGreaterThan(avg(false) * 1.1);
  });
});

function touchTip(sim: Sim) {
  const sq = sim.squad;
  const tip = sq.chain[sq.chain.length - 1]!;
  sq.leader.x = tip.x + 8;
  sq.leader.y = tip.y;
}

describe('Воїн: кільце', () => {
  it('замкнули кільце → хвіст стає нерухомою групою з більшою відстанню, щит 50% на 10 с; далі повертається в хвіст; КД 90 с', () => {
    const { sim, events } = makeSim(10, { leaderSpeed: 120 });
    const sq = sim.squad;
    touchTip(sim);
    sim.update(1 / 120, NEUTRAL_INTENT);
    expect(events.some((e) => e.type === 'ringClosed')).toBe(true);
    expect(sq.chain.length).toBe(0);
    const g = sq.groups[0]!;
    expect(g.ring).toBe(true);
    expect(g.units.length).toBe(10);
    for (const u of g.units) expect(u.shield).toBeCloseTo(u.maxHp * 0.5);
    expect(sq.leader.shield).toBeCloseTo(sq.leader.maxHp * 0.5);
    // коти займають слоти і більше не рухаються
    tick(sim, 3);
    const before = g.units.map((u) => [u.x, u.y]);
    tick(sim, 1);
    const moved = Math.max(...g.units.map((u, i) => Math.hypot(u.x - before[i]![0], u.y - before[i]![1])));
    const gap = Math.hypot(g.units[0]!.x - g.units[1]!.x, g.units[0]!.y - g.units[1]!.y);
    const slotGap = sq.cfg.unitSpacing * sq.cfg.warriorRingSpacingMult;
    console.log(`[кільце] зсув за 1 с: ${moved.toFixed(3)} px; відстань між сусідами у слотах ${slotGap.toFixed(1)} (SPACING ${sq.cfg.unitSpacing})`);
    expect(moved).toBeLessThan(0.01);
    expect(slotGap).toBeGreaterThan(sq.cfg.unitSpacing * sq.cfg.holdSpacingMult);
    expect(gap).toBeGreaterThan(sq.cfg.unitSpacing);
    // дотик головою раніше часу не підбирає кільце
    sq.leader.x = g.units[0]!.x + 5;
    sq.leader.y = g.units[0]!.y;
    tick(sim, 0.3);
    expect(sq.chain.length).toBe(0);
    // кінець дії щита: група повертається в хвіст, щити зникли
    tick(sim, 10);
    expect(sq.groups.length).toBe(0);
    expect(sq.chain.length).toBe(10);
    expect(sq.chain.every((u) => u.shield === 0 && u.mode === 'chain')).toBe(true);
    expect(sq.leader.shield).toBe(0);
    expect(sim.warrior.ringCooldownLeft).toBeGreaterThan(60);
    expect(events.some((e) => e.type === 'holdExpired')).toBe(false);
  });
  it('кільце не розпадається на смерть: коти групи б\'ються і можуть вмерти як у відкушеній групі', () => {
    const { sim } = makeSim(10, { leaderSpeed: 120 });
    touchTip(sim);
    sim.update(1 / 120, NEUTRAL_INTENT);
    const g = sim.squad.groups[0]!;
    const u = g.units[0]!;
    sim.squad.damageUnit(u, u.shield + u.maxHp); // знімаємо щит і HP
    expect(u.mode).toBe('down');
    expect(g.units.length).toBe(9);
  });
  it('щит-поглинач гасить урон, потім іде HP', () => {
    const { sim } = makeSim(10, { leaderSpeed: 120 });
    touchTip(sim);
    sim.update(1 / 120, NEUTRAL_INTENT);
    const u = sim.squad.groups[0]!.units[0]!;
    const sh = u.shield;
    sim.squad.damageUnit(u, sh - 1);
    expect(u.hp).toBe(u.maxHp);
    sim.squad.damageUnit(u, 11);
    expect(u.shield).toBe(0);
    expect(u.hp).toBe(u.maxHp - 10);
  });
  it('менше котів, ніж треба — кільце не рахується', () => {
    const { sim, events } = makeSim(4);
    touchTip(sim);
    tick(sim, 0.1);
    expect(events.some((e) => e.type === 'ringClosed')).toBe(false);
  });
  it('реальне керування: голова замикає кільце, наздоганяючи свій хвіст', () => {
    const { sim, events } = makeSim(12, { leaderSpeed: 120 });
    const sq = sim.squad;
    const dt = 1 / 120;
    for (let i = 0; i < 120 * 14 && !events.some((e) => e.type === 'ringClosed'); i++) {
      const tip = sq.chain[sq.chain.length - 1]!;
      const t = i * dt;
      const target = t < 1.2 ? 0 : Math.atan2(tip.y - sq.leader.y, tip.x - sq.leader.x);
      sim.update(dt, { ...NEUTRAL_INTENT, targetAngle: target });
    }
    console.log(`[кільце] керуванням замкнуто: ${events.some((e) => e.type === 'ringClosed')}`);
    expect(events.some((e) => e.type === 'ringClosed')).toBe(true);
  });
});

describe('Воїн: тогл', () => {
  it('вимкнений: не б\'є, активка не вмикається, кільце не рахується', () => {
    const { sim, events } = makeSim(10);
    sim.warrior.setEnabled(false);
    sim.squad.godMode = true;
    const l = sim.squad.leader;
    const rat = sim.enemies.spawn('rat', l.x + 20, l.y)!;
    rat.slowMult = 0; rat.slowTime = 1e6;
    sim.update(1 / 120, F);
    expect(rat.hp).toBe(rat.maxHp);
    expect(events.some((e) => e.type === 'abilityStart' || e.type === 'leaderSlash')).toBe(false);
    touchTip(sim);
    tick(sim, 0.1);
    expect(events.some((e) => e.type === 'ringClosed')).toBe(false);
  });
  it('вимкнення посеред ефектів знімає щити, бафф, формацію і передній щит', () => {
    const { sim } = makeSim(10);
    const sq = sim.squad;
    sim.update(1 / 120, F);
    touchTip(sim);
    tick(sim, 0.05);
    expect(sq.hasRingGroup()).toBe(true);
    sim.warrior.setEnabled(false);
    expect(sq.hasRingGroup()).toBe(false);
    expect(sq.chain.length).toBe(10);
    expect(sq.frontGuardHalfArc).toBe(0);
    expect(sq.modifiers.get('damage')).toBe(1);
    expect(sq.leader.shield).toBe(0);
    expect(sq.chain.every((u) => u.shield === 0)).toBe(true);
    sim.warrior.setEnabled(true);
    expect(sim.warrior.enabled).toBe(true);
  });
});

describe('Воїн: лідер у кільці', () => {
  it('лідер стає в слот формації разом із котами й стоїть; усі на одному колі', () => {
    const { sim } = makeSim(10, { leaderSpeed: 120 });
    const sq = sim.squad;
    touchTip(sim);
    sim.update(1 / 120, NEUTRAL_INTENT);
    const g = sq.ringGroupOfLeader()!;
    expect(g).toBeDefined();
    expect(g.slots.length).toBe(11);
    tick(sim, 3, { ...NEUTRAL_INTENT, targetAngle: 0, turnAxis: 0 });
    const p0 = { x: sq.leader.x, y: sq.leader.y };
    tick(sim, 2);
    expect(Math.hypot(sq.leader.x - p0.x, sq.leader.y - p0.y)).toBeLessThan(0.01);
    expect(sq.leader.speed).toBe(0);
    const rs = [...g.units, sq.leader].map((u) => Math.hypot(u.x - g.cx, u.y - g.cy));
    console.log(`[кільце+лідер] радіуси: ${rs.map((r) => r.toFixed(1)).join(' ')}`);
    expect(Math.max(...rs) - Math.min(...rs)).toBeLessThan(0.5);
  });
  it('ривок виривається з кільця: коти повертаються в хвіст, щит лишається', () => {
    const { sim } = makeSim(10, { leaderSpeed: 120 });
    const sq = sim.squad;
    touchTip(sim);
    sim.update(1 / 120, NEUTRAL_INTENT);
    tick(sim, 0.2, { ...NEUTRAL_INTENT, dash: true });
    expect(sq.hasRingGroup()).toBe(true); // перші 0.5 с — захист від випадкового натискання
    tick(sim, 0.6, { ...NEUTRAL_INTENT, dash: true });
    expect(sq.hasRingGroup()).toBe(false);
    expect(sq.chain.length).toBe(10);
    expect(sim.warrior.ringShieldLeft).toBeGreaterThan(5);
  });
});

describe('підбір загону: відкус/недоторканість', () => {
  const rejoinScenario = (over: Partial<SquadConfig>) => {
    const { sim, events } = makeSim(12, { leaderSpeed: 120, splitFirstDetachableIndex: 5, ...over });
    sim.warrior.setEnabled(false);
    sim.squad.godMode = true;
    const sq = sim.squad;
    // відкушуємо хвіст великим розворотом
    for (let i = 0; i < 120 * 40 && !events.some((e) => e.type === 'split'); i++) sim.update(1 / 120, { ...NEUTRAL_INTENT, turnAxis: -1 });
    expect(events.some((e) => e.type === 'split')).toBe(true);
    // їдемо крізь центр групи, потім просто вперед
    for (let i = 0; i < 120 * 20 && sq.groups.length > 0; i++) {
      const g = sq.groups[0]!;
      sim.update(1 / 120, { ...NEUTRAL_INTENT, targetAngle: Math.atan2(g.cy - sq.leader.y, g.cx - sq.leader.x) });
    }
    expect(sq.groups.length).toBe(0);
    const splitsAtPickup = events.filter((e) => e.type === 'split').length;
    for (let i = 0; i < 120 * 6; i++) sim.update(1 / 120, { ...NEUTRAL_INTENT, targetAngle: sq.leader.heading });
    return { splitsAfter: events.filter((e) => e.type === 'split').length - splitsAtPickup, chain: sq.chain.length };
  };
  it('після підбору групи нових відкусів немає, всі в хвості', () => {
    const r = rejoinScenario({});
    console.log(`[підбір] нових відкусів: ${r.splitsAfter}, у хвості: ${r.chain}`);
    expect(r.splitsAfter).toBe(0);
    expect(r.chain).toBe(12);
  });
  it('піднятий кіт не відкушується одразу', () => {
    const { sim, events } = makeSim(8, { leaderSpeed: 120, splitFirstDetachableIndex: 2 });
    sim.warrior.setEnabled(false);
    const sq = sim.squad;
    const u = sq.chain[5]!;
    sq.damageUnit(u, 9999);
    expect(sq.fallen.length).toBe(1);
    const f = sq.fallen[0]!;
    for (let i = 0; i < 120 * 6; i++) sim.update(1 / 120, { ...NEUTRAL_INTENT, targetAngle: Math.atan2(f.y - sq.leader.y, f.x - sq.leader.x) });
    for (let i = 0; i < 120 * 4; i++) sim.update(1 / 120, { ...NEUTRAL_INTENT, targetAngle: sq.leader.heading });
    expect(events.filter((e) => e.type === 'split').length).toBe(0);
    expect(sq.chain.length).toBe(8);
  });
});
