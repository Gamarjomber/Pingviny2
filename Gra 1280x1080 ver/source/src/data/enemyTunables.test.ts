import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SQUAD_CONFIG } from './squadConfig';
import { ENEMY_DEFS } from './enemies';
import { ENEMY_TUNABLES, resetEnemyConfig } from './enemyTunables';
import { NEUTRAL_INTENT } from '../sim/intent';
import { Sim } from '../sim/Sim';

afterEach(() => resetEnemyConfig());

describe('налаштування ворогів', () => {
  it('ключі унікальні, значення за замовчуванням у межах повзунків', () => {
    expect(new Set(ENEMY_TUNABLES.map((t) => t.key)).size).toBe(ENEMY_TUNABLES.length);
    for (const t of ENEMY_TUNABLES) {
      expect(t.get(), t.key).toBeGreaterThanOrEqual(t.min);
      expect(t.get(), t.key).toBeLessThanOrEqual(t.max);
    }
  });
  it('охоплює і щура, і вовкулака з ривком, спавн і поведінку', () => {
    const keys = ENEMY_TUNABLES.map((t) => t.key);
    for (const k of ['rat.maxHp', 'wolf.speed', 'wolf.lunge.windup', 'spawn.baseRate', 'behavior.knockbackDecay']) expect(keys).toContain(k);
  });
  it('зміна наживо впливає на симуляцію, скидання повертає дефолт', () => {
    const arena = { width: 3000, height: 3000, solids: [], spawn: { x: 1500, y: 1500, heading: 0 } };
    const run = (speed: number) => {
      ENEMY_TUNABLES.find((t) => t.key === 'rat.speed')!.set(speed);
      const sim = new Sim({ ...DEFAULT_SQUAD_CONFIG, leaderSpeed: 1 }, arena, 1);
      sim.autoSpawn = false;
      sim.warrior.setEnabled(false);
      sim.squad.godMode = true;
      const e = sim.enemies.spawn('rat', 1500 + 200, 1500)!;
      for (let i = 0; i < 60; i++) sim.update(1 / 120, NEUTRAL_INTENT);
      return 200 - (e.x - 1500);
    };
    const slow = run(40);
    const fast = run(160);
    expect(fast).toBeGreaterThan(slow * 2);
    resetEnemyConfig();
    expect(ENEMY_DEFS.rat!.speed).toBe(88);
  });
});
