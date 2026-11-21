import type { EventBus } from '../../core/EventBus';
import type { Rng } from '../../core/Rng';
import { ENEMY_DEFS } from '../../data/enemies';
import { UNIT_CLASSES } from '../../data/unitClasses';
import { MAX_ENEMY_RADIUS, type EnemyState, type EnemySystem } from '../enemies/EnemySystem';
import type { GameEvents } from '../events';
import type { Squad } from '../squad/Squad';
import type { UnitState } from '../squad/types';
import { collideCircle, type World } from '../world/colliders';
import { rollDamage } from './damage';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  radius: number;
  pierceLeft: number;
  color: number;
  hit: Set<number>;
  dead: boolean;
}

/**
 * Автоатака: кожен кіт — турель зі своїм радіусом від своєї точки.
 * Бʼє той, хто живий і в хвості, і у відчепленій групі. Впалі нічого не роблять.
 */
export class CombatSystem {
  projectiles: Projectile[] = [];

  constructor(
    private readonly squad: Squad,
    private readonly enemies: EnemySystem,
    private readonly world: World,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
  ) {}

  clear(): void {
    this.projectiles = [];
  }

  update(dt: number): void {
    for (const u of this.squad.aliveUnits()) this.updateUnit(u, dt);
    this.updateProjectiles(dt);
  }

  private updateUnit(u: UnitState, dt: number): void {
    const def = UNIT_CLASSES[u.classId];
    if (!def) return;
    const atk = def.attack;
    u.atkCd -= dt;
    if (u.atkCd > 0 || atk.kind === 'none') return;

    if (atk.kind === 'heal') {
      if (this.tryHeal(u, atk.range, atk.healAmount ?? 0)) u.atkCd = atk.interval;
      return;
    }

    const near = this.nearestEnemies(u.x, u.y, atk.range, atk.kind === 'melee' ? (atk.maxTargets ?? 1) : 1);
    if (near.length === 0) return; // кд не тратимо — вдарить, щойно хтось зайде в радіус

    if (atk.kind === 'melee') {
      for (const e of near) this.enemies.hurt(e, rollDamage(atk.damage, this.squad, this.rng), u.x, u.y, 140);
      this.bus.emit('attack', { kind: 'melee', x: u.x, y: u.y, tx: near[0]!.x, ty: near[0]!.y, color: 0xffffff });
    } else {
      const t = near[0]!;
      const dx = t.x - u.x;
      const dy = t.y - u.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = atk.projectileSpeed ?? 200;
      this.projectiles.push({
        x: u.x,
        y: u.y,
        vx: (dx / d) * speed,
        vy: (dy / d) * speed,
        damage: rollDamage(atk.damage, this.squad, this.rng),
        life: (atk.range * 1.4) / speed,
        radius: 2,
        pierceLeft: atk.pierce ?? 0,
        color: atk.color ?? 0xffffff,
        hit: new Set(),
        dead: false,
      });
      this.bus.emit('attack', { kind: 'projectile', x: u.x, y: u.y, tx: t.x, ty: t.y, color: atk.color ?? 0xffffff });
    }
    u.atkCd = atk.interval;
  }

  private nearestEnemies(x: number, y: number, range: number, count: number): EnemyState[] {
    const found: { e: EnemyState; d: number }[] = [];
    const list = this.enemies.list;
    this.enemies.grid.query(x, y, range + MAX_ENEMY_RADIUS, (j) => {
      const e = list[j]!;
      if (e.dead) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= range + ENEMY_DEFS[e.defId]!.radius) found.push({ e, d });
    });
    found.sort((a, b) => a.d - b.d);
    return found.slice(0, count).map((f) => f.e);
  }

  /** Жриця лікує найбільш пошкодженого союзника поруч (включно з лідером). */
  private tryHeal(u: UnitState, range: number, amount: number): boolean {
    let best: UnitState | null = null;
    let bestRatio = 1;
    for (const o of this.squad.aliveUnits()) {
      if (Math.hypot(o.x - u.x, o.y - u.y) > range) continue;
      const r = o.hp / o.maxHp;
      if (r < bestRatio) {
        bestRatio = r;
        best = o;
      }
    }
    const l = this.squad.leader;
    const leaderRatio = l.hp / l.maxHp;
    if (Math.hypot(l.x - u.x, l.y - u.y) <= range && leaderRatio < bestRatio) {
      this.squad.healLeader(amount);
      this.bus.emit('attack', { kind: 'heal', x: u.x, y: u.y, tx: l.x, ty: l.y, color: 0x7dffb0 });
      return true;
    }
    if (best) {
      this.squad.healUnit(best, amount);
      this.bus.emit('attack', { kind: 'heal', x: u.x, y: u.y, tx: best.x, ty: best.y, color: 0x7dffb0 });
      return true;
    }
    return false;
  }

  private updateProjectiles(dt: number): void {
    const list = this.enemies.list;
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || collideCircle(this.world.solids, p.x, p.y, p.radius)) {
        p.dead = true;
        continue;
      }
      this.enemies.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, (j) => {
        if (p.dead) return;
        const e = list[j]!;
        if (e.dead || p.hit.has(e.id)) return;
        if (Math.hypot(e.x - p.x, e.y - p.y) < p.radius + ENEMY_DEFS[e.defId]!.radius) {
          p.hit.add(e.id);
          this.enemies.hurt(e, p.damage, p.x - p.vx * 0.01, p.y - p.vy * 0.01, 90);
          if (p.pierceLeft-- <= 0) p.dead = true;
        }
      });
    }
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
  }
}
