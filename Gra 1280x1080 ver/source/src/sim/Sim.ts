import { EventBus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import type { ArenaDef } from '../data/arena';
import { ENEMY_DEFS, SPAWN_CONFIG } from '../data/enemies';
import type { SquadConfig } from '../data/squadConfig';
import { CombatSystem } from './combat/CombatSystem';
import { EnemySystem } from './enemies/EnemySystem';
import { WarriorSystem } from './leader/WarriorSystem';
import type { GameEvents } from './events';
import type { SteerIntent } from './intent';
import { Squad } from './squad/Squad';
import { collideCircle } from './world/colliders';

/**
 * Вся симуляція етапу в одному місці: відряд, вороги, бій, спавн.
 * Phaser про неї нічого не знає: сцена викликає update(), рендер читає стан.
 */
export class Sim {
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;
  readonly squad: Squad;
  readonly enemies: EnemySystem;
  readonly combat: CombatSystem;
  /** Клас лідера (поки Воїн). Тогл: warrior.setEnabled(false). */
  readonly warrior: WarriorSystem;
  time = 0;
  gameOver = false;
  autoSpawn = true;
  /** Радіус видимої області навколо лідера: ворогів спавнимо за її межею. Виставляє камера. */
  viewRadius = 260;
  private spawnAcc = 0;

  constructor(
    readonly cfg: SquadConfig,
    readonly arena: ArenaDef,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.squad = new Squad(cfg, arena, this.bus, this.rng, arena.spawn);
    this.enemies = new EnemySystem(this.squad, arena, this.bus, this.rng);
    this.combat = new CombatSystem(this.squad, this.enemies, arena, this.bus, this.rng);
    this.warrior = new WarriorSystem(this.squad, this.enemies, this.bus, this.rng);
    this.bus.on('gameOver', () => (this.gameOver = true));
  }

  update(dt: number, intent: SteerIntent): void {
    if (this.gameOver) return;
    this.time += dt;
    this.squad.update(dt, intent);
    this.enemies.update(dt);
    this.combat.update(dt);
    this.warrior.update(dt, intent);
    if (this.autoSpawn) this.updateSpawner(dt);
  }

  /** PressureTimer: чим довше етап, тим густіше йдуть вороги. */
  private updateSpawner(dt: number): void {
    const rate = SPAWN_CONFIG.baseRate + SPAWN_CONFIG.rateGrowthPerSec * this.time;
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.list.length >= SPAWN_CONFIG.maxEnemies) continue;
      this.spawnRandom();
    }
  }

  /** Новий ворог на кільці за межею видимості (всередині арени). */
  spawnRandom(defId?: string): void {
    const id = defId ?? this.pickDef();
    const def = ENEMY_DEFS[id];
    if (!def) return;
    const l = this.squad.leader;
    for (let tries = 0; tries < 8; tries++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.viewRadius + SPAWN_CONFIG.ringMargin + this.rng.range(0, 40);
      const x = Math.min(this.arena.width - 12, Math.max(12, l.x + Math.cos(a) * r));
      const y = Math.min(this.arena.height - 12, Math.max(12, l.y + Math.sin(a) * r));
      if (collideCircle(this.arena.solids, x, y, def.radius)) continue;
      this.enemies.spawn(id, x, y);
      return;
    }
  }

  private pickDef(): string {
    const pool = Object.values(ENEMY_DEFS).filter((d) => this.time >= d.unlockTime);
    const total = pool.reduce((s, d) => s + d.spawnWeight, 0);
    let roll = this.rng.next() * total;
    for (const d of pool) {
      roll -= d.spawnWeight;
      if (roll <= 0) return d.id;
    }
    return pool[0]!.id;
  }
}
