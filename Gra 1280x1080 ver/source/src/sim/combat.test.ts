import { describe, expect, it } from 'vitest';
import { DEFAULT_SQUAD_CONFIG } from '../data/squadConfig';
import { ENEMY_DEFS } from '../data/enemies';
import { NEUTRAL_INTENT } from './intent';
import { Sim } from './Sim';

const arena = { width: 3000, height: 3000, solids: [], spawn: { x: 1500, y: 1500, heading: 0 } };

function makeSim(classes: string[], speed = 1) {
  // лідер майже стоїть, щоб тест не залежав від того, куди відʼїде хвіст
  const sim = new Sim({ ...DEFAULT_SQUAD_CONFIG, leaderSpeed: speed }, arena, 1);
  sim.autoSpawn = false;
  sim.warrior.setEnabled(false); // ці тести — про бій котів; лідер-Воїн перевіряється окремо
  for (const c of classes) sim.squad.addUnit(c);
  return sim;
}
const run = (sim: Sim, sec: number, intent = NEUTRAL_INTENT) => {
  for (let i = 0; i < sec * 120; i++) sim.update(1 / 120, intent);
};

describe('бій', () => {
  it('лучниця вбиває щура здалеку', () => {
    const sim = makeSim(['archer']);
    const u = sim.squad.chain[0]!;
    const rat = sim.enemies.spawn('rat', u.x - 100, u.y - 40)!;
    run(sim, 4);
    expect(rat.dead).toBe(true);
  });
  it('контактний урон поштучний: один удар ворога б\'є одного кота, а не всіх поруч', () => {
    const sim = makeSim(['knight', 'knight', 'knight', 'knight', 'knight']);
    const mid = sim.squad.chain[3]!;
    const rat = sim.enemies.spawn('rat', mid.x, mid.y - 2)!;
    rat.mode = 'rear';
    sim.update(1 / 120, NEUTRAL_INTENT);
    const hurt = sim.squad.chain.filter((u) => u.hp < u.maxHp);
    expect(hurt.length).toBe(1);
    expect(hurt[0]!.maxHp - hurt[0]!.hp).toBe(ENEMY_DEFS.rat!.contactDamage);
  });
  it("ворог б'є не частіше свого hitInterval і сам відлітає", () => {
    const sim = makeSim(['knight', 'knight', 'knight', 'knight', 'knight']);
    const u = sim.squad.chain[3]!;
    const rat = sim.enemies.spawn('rat', u.x, u.y - 2)!;
    rat.mode = 'rear';
    sim.update(1 / 120, NEUTRAL_INTENT);
    const total = () => sim.squad.chain.reduce((s, c) => s + (c.maxHp - c.hp), 0);
    const afterFirst = total();
    expect(afterFirst).toBe(ENEMY_DEFS.rat!.contactDamage);
    expect(Math.hypot(rat.kx, rat.ky)).toBeGreaterThan(10);
    sim.update(1 / 120, NEUTRAL_INTENT);
    expect(total()).toBe(afterFirst);
  });
  it('вовкулак: замах-телеграф перед ривком (удар не без попередження)', () => {
    const sim = makeSim([]);
    const l = sim.squad.leader;
    const wolf = sim.enemies.spawn('wolf', l.x + 40, l.y)!;
    wolf.mode = 'head';
    const seen: string[] = ['chase'];
    for (let i = 0; i < 120 * 2; i++) {
      sim.squad.godMode = true;
      sim.update(1 / 120, NEUTRAL_INTENT);
      if (seen[seen.length - 1] !== wolf.state) seen.push(wolf.state);
    }
    expect(seen.slice(0, 4)).toEqual(['chase', 'windup', 'lunge', 'recover']);
  });
  it('відчеплена група б\'ється сама, поки в живих (і далеко від голови)', () => {
    const sim = makeSim(['knight', 'knight', 'knight', 'knight', 'swordsman', 'archer', 'mage'], 1);
    const sq = sim.squad;
    const a = sq.chain[3]!;
    const b = sq.chain[4]!;
    sq.leader.x = (a.x + b.x) / 2;
    sq.leader.y = a.y;
    sq.checkSplit();
    expect(sq.groups.length).toBe(1);
    const g = sq.groups[0]!;
    sq.leader.x -= 1500; // голова відʼїхала
    const rats = [0, 1, 2].map((i) => sim.enemies.spawn('rat', g.cx + 60 + i * 6, g.cy)!);
    rats.forEach((r) => (r.mode = 'rear'));
    for (let i = 0; i < 120 * 5; i++) {
      sim.update(1 / 120, NEUTRAL_INTENT);
      sq.leader.x = g.cx - 1500;
    }
    expect(rats.every((r) => r.dead)).toBe(true);
  });
  it('впалий кіт не атакує', () => {
    const sim = makeSim(['archer', 'knight']);
    const archer = sim.squad.chain[0]!;
    sim.squad.damageUnit(archer, 99999);
    const rat = sim.enemies.spawn('rat', archer.x - 60, archer.y)!;
    rat.mode = 'rear';
    sim.squad.leader.x = archer.x + 900;
    run(sim, 1);
    expect(sim.combat.projectiles.length).toBe(0);
  });
  it('жриця лікує пошкодженого сусіда', () => {
    const sim = makeSim(['knight', 'priest']);
    const knight = sim.squad.chain[0]!;
    knight.hp = 50;
    run(sim, 2);
    expect(knight.hp).toBeGreaterThan(50);
  });
});
