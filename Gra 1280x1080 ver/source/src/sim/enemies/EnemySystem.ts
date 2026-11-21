import type { EventBus } from '../../core/EventBus';
import type { Rng } from '../../core/Rng';
import { SpatialHash } from '../../core/SpatialHash';
import { ENEMY_BEHAVIOR, ENEMY_DEFS } from '../../data/enemies';
import type { GameEvents } from '../events';
import type { Squad } from '../squad/Squad';
import type { UnitState } from '../squad/types';
import { collideCircle, type World } from '../world/colliders';

export type EnemyAiState = 'chase' | 'windup' | 'lunge' | 'recover';

export interface EnemyState {
  id: number;
  defId: string;
  x: number;
  y: number;
  /** Швидкість відкидання (затухає). */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  state: EnemyAiState;
  stateTime: number;
  /** 'head' — іде на лідера, 'rear' — на найближчого кота. */
  mode: 'head' | 'rear';
  targetUnitId: number | null;
  retarget: number;
  hitCd: number;
  /** Зафіксований напрямок замаху/ривка. */
  dirx: number;
  diry: number;
  flash: number;
  /** Сповільнення (активка Воїна): множник швидкості, діє поки slowTime > 0. */
  slowTime: number;
  slowMult: number;
  faceX: number;
  anim: number;
  dead: boolean;
}

/** Найбільший радіус ворога — для запитів до сітки. */
export const MAX_ENEMY_RADIUS = 12;

/** Ворожі істоти: цілі, рух, телеграф ривка, контактний урон поштучно по котах. */
export class EnemySystem {
  list: EnemyState[] = [];
  readonly grid = new SpatialHash(32);
  private nextId = 1;
  private alive: UnitState[] = [];

  constructor(
    private readonly squad: Squad,
    private readonly world: World,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
  ) {}

  spawn(defId: string, x: number, y: number): EnemyState | null {
    const def = ENEMY_DEFS[defId];
    if (!def) return null;
    const e: EnemyState = {
      id: this.nextId++,
      defId,
      x,
      y,
      kx: 0,
      ky: 0,
      hp: def.maxHp,
      maxHp: def.maxHp,
      state: 'chase',
      stateTime: 0,
      mode: this.rng.next() < def.headBias ? 'head' : 'rear',
      targetUnitId: null,
      retarget: this.rng.range(0, 0.4),
      hitCd: 0,
      dirx: 1,
      diry: 0,
      flash: 0,
      slowTime: 0,
      slowMult: 1,
      faceX: 1,
      anim: this.rng.next() * 10,
      dead: false,
    };
    this.list.push(e);
    return e;
  }

  clear(): void {
    this.list = [];
  }

  /** Сповільнити ворога на ttl секунд (береться найсильніший ефект). */
  slow(e: EnemyState, mult: number, ttl: number): void {
    if (e.slowTime <= 0 || mult < e.slowMult) e.slowMult = mult;
    e.slowTime = Math.max(e.slowTime, ttl);
  }

  /** Урон ворогу. dir — від джерела до ворога (для відкидання). */
  hurt(e: EnemyState, amount: number, fromX: number, fromY: number, force: number): void {
    if (e.dead) return;
    e.hp -= amount;
    e.flash = 0.1;
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.kx += (dx / d) * force;
    e.ky += (dy / d) * force;
    this.bus.emit('damage', { x: e.x, y: e.y, amount, kind: 'enemy' });
    if (e.hp <= 0) {
      e.dead = true;
      this.bus.emit('enemyDied', { x: e.x, y: e.y, defId: e.defId });
    }
  }

  update(dt: number): void {
    if (this.list.some((e) => e.dead)) this.list = this.list.filter((e) => !e.dead);
    this.alive = this.squad.aliveUnits();

    this.grid.clear();
    for (let i = 0; i < this.list.length; i++) this.grid.insert(i, this.list[i]!.x, this.list[i]!.y);

    for (let i = 0; i < this.list.length; i++) this.step(i, dt);
    this.contacts();
  }

  // --------------------------------------------------------------- поведінка

  private pickTarget(e: EnemyState): void {
    e.targetUnitId = null;
    if (e.mode === 'head') return;
    let best: UnitState | null = null;
    let bd = Infinity;
    for (const u of this.alive) {
      const d = (u.x - e.x) ** 2 + (u.y - e.y) ** 2;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    e.targetUnitId = best ? best.id : null;
  }

  private targetPos(e: EnemyState): { x: number; y: number } {
    if (e.targetUnitId !== null) {
      const u = this.alive.find((c) => c.id === e.targetUnitId);
      if (u) return u;
      this.pickTarget(e);
      if (e.targetUnitId !== null) {
        const u2 = this.alive.find((c) => c.id === e.targetUnitId);
        if (u2) return u2;
      }
    }
    return this.squad.leader;
  }

  private step(index: number, dt: number): void {
    const e = this.list[index]!;
    if (e.dead) return;
    const def = ENEMY_DEFS[e.defId]!;
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.slowTime = Math.max(0, e.slowTime - dt);
    const slow = e.slowTime > 0 ? e.slowMult : 1;
    e.anim += dt;
    e.retarget -= dt;
    if (e.retarget <= 0) {
      e.retarget = ENEMY_BEHAVIOR.retargetMin + this.rng.next() * ENEMY_BEHAVIOR.retargetSpread;
      this.pickTarget(e);
    }

    const t = this.targetPos(e);
    let dx = t.x - e.x;
    let dy = t.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist;
    dy /= dist;

    let vx = 0;
    let vy = 0;
    e.stateTime += dt;
    switch (e.state) {
      case 'chase':
        vx = dx * def.speed;
        vy = dy * def.speed;
        e.faceX = dx >= 0 ? 1 : -1;
        if (def.lunge && dist <= def.lunge.triggerRange) {
          e.state = 'windup'; // Telegraph: замах, потім ривок по зафіксованому напрямку
          e.stateTime = 0;
          e.dirx = dx;
          e.diry = dy;
        }
        break;
      case 'windup':
        // оттягується назад і завмирає в стійці
        vx = -e.dirx * def.speed * def.lunge!.windupRetreat;
        vy = -e.diry * def.speed * def.lunge!.windupRetreat;
        e.faceX = e.dirx >= 0 ? 1 : -1;
        if (e.stateTime >= def.lunge!.windup) {
          e.state = 'lunge';
          e.stateTime = 0;
        }
        break;
      case 'lunge':
        vx = e.dirx * def.speed * def.lunge!.speedMult;
        vy = e.diry * def.speed * def.lunge!.speedMult;
        if (e.stateTime >= def.lunge!.duration) {
          e.state = 'recover';
          e.stateTime = 0;
        }
        break;
      case 'recover':
        if (e.stateTime >= def.lunge!.recover) {
          e.state = 'chase';
          e.stateTime = 0;
        }
        break;
    }

    // розштовхування з сусідами, щоб натовп не злипався в одну точку
    let sx = 0;
    let sy = 0;
    this.grid.query(e.x, e.y, def.radius * 2, (j) => {
      if (j === index) return;
      const o = this.list[j]!;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const d2 = ox * ox + oy * oy;
      const min = def.radius * ENEMY_BEHAVIOR.separationDistMult;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        sx += (ox / d) * (min - d);
        sy += (oy / d) * (min - d);
      }
    });

    e.x += (vx * slow + e.kx + sx * ENEMY_BEHAVIOR.separationPush) * dt;
    e.y += (vy * slow + e.ky + sy * ENEMY_BEHAVIOR.separationPush) * dt;
    const decay = Math.exp(-ENEMY_BEHAVIOR.knockbackDecay * dt);
    e.kx *= decay;
    e.ky *= decay;

    for (let pass = 0; pass < 2; pass++) {
      const c = collideCircle(this.world.solids, e.x, e.y, def.radius);
      if (!c) break;
      e.x += c.nx * c.depth;
      e.y += c.ny * c.depth;
    }
  }

  // ---------------------------------------------------------- контактний урон

  /**
   * Дотик ворога б'є того кота (або лідера), якого він торкнувся, і трохи відкидає самого ворога.
   * Урон поштучний: кожен кіт — окрема ціль.
   */
  private contacts(): void {
    const squad = this.squad;
    const leader = squad.leader;
    const reachL = squad.cfg.leaderRadius;
    this.grid.query(leader.x, leader.y, reachL + MAX_ENEMY_RADIUS, (j) => {
      const e = this.list[j]!;
      if (e.dead || e.hitCd > 0) return;
      const def = ENEMY_DEFS[e.defId]!;
      if (Math.hypot(e.x - leader.x, e.y - leader.y) < reachL + def.radius) {
        if (squad.damageLeader(def.contactDamage, e.x, e.y)) this.afterHit(e, def.hitInterval, def.selfKnockback, leader.x, leader.y);
      }
    });

    const reachU = squad.cfg.unitRadius;
    for (const u of this.alive) {
      if (u.mode === 'down') continue;
      this.grid.query(u.x, u.y, reachU + MAX_ENEMY_RADIUS, (j) => {
        const e = this.list[j]!;
        if (e.dead || e.hitCd > 0 || u.mode === 'down') return;
        const def = ENEMY_DEFS[e.defId]!;
        if (Math.hypot(e.x - u.x, e.y - u.y) < reachU + def.radius) {
          squad.damageUnit(u, def.contactDamage);
          this.afterHit(e, def.hitInterval, def.selfKnockback, u.x, u.y);
        }
      });
    }
  }

  private afterHit(e: EnemyState, interval: number, knock: number, fromX: number, fromY: number): void {
    e.hitCd = interval;
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.kx += (dx / d) * knock;
    e.ky += (dy / d) * knock;
  }
}
