import type { EventBus } from '../../core/EventBus';
import type { Rng } from '../../core/Rng';
import { ENEMY_DEFS } from '../../data/enemies';
import { MAX_ENEMY_RADIUS, type EnemyState, type EnemySystem } from '../enemies/EnemySystem';
import { rollDamage } from '../combat/damage';
import { collideCircle } from '../world/colliders';
import type { GameEvents } from '../events';
import type { SteerIntent } from '../intent';
import type { Squad } from '../squad/Squad';
import type { LeaderClassSystem } from './LeaderClass';

const MOD_SOURCE = 'warrior';

/** Хвиля-«U»: передня дуга (опукла вперед) і дві довгі «руки» назад. (x, y) — центр передньої дуги. */
export interface LeaderWave {
  x: number;
  y: number;
  dir: number;
  traveled: number;
  range: number;
  length: number;
  halfWidth: number;
  damage: number;
  hit: Set<number>;
  dead: boolean;
}

/** Контур «U» у світових координатах: рука → дуга → рука. */
export function waveOutline(w: LeaderWave, arcSteps = 6): { x: number; y: number }[] {
  const c = Math.cos(w.dir);
  const s = Math.sin(w.dir);
  const to = (lx: number, ly: number) => ({ x: w.x + lx * c - ly * s, y: w.y + lx * s + ly * c });
  const pts = [to(-w.length, -w.halfWidth), to(0, -w.halfWidth)];
  for (let i = 1; i < arcSteps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / arcSteps;
    pts.push(to(Math.cos(a) * w.halfWidth, Math.sin(a) * w.halfWidth));
  }
  pts.push(to(0, w.halfWidth), to(-w.length, w.halfWidth));
  return pts;
}

/** Чи зачіпає контур «U» коло ворога (контур має невелику товщину). */
export function waveHits(w: LeaderWave, ex: number, ey: number, er: number): boolean {
  const pts = waveOutline(w);
  const reach = er + 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((ex - a.x) * abx + (ey - a.y) * aby) / (abx * abx + aby * aby || 1)));
    if (Math.hypot(ex - (a.x + abx * t), ey - (a.y + aby * t)) <= reach) return true;
  }
  return false;
}

/**
 * Лідер-Воїн.
 *  - Атака: рубаюча хвиля-сектор перед головою (автоматично, коли хтось у секторі).
 *  - Активка (F): сповільнення ворогів, передній щит, більший радіус удару, бафф урону/крит-урону команди.
 *  - Пасивка «кільце»: голова торкається кінця хвоста — коти строяться в рівне коло, усі отримують щит-поглинач.
 * Усі числа беруться з squad.cfg (warrior*), тож крутяться наживо.
 */
export class WarriorSystem implements LeaderClassSystem {
  readonly id = 'warrior';
  enabled = true;

  abilityTimeLeft = 0;
  abilityCooldownLeft = 0;
  ringCooldownLeft = 0;
  ringShieldLeft = 0;
  private slashCd = 0;
  /** Хвилі, що летять зараз. */
  waves: LeaderWave[] = [];

  constructor(
    private readonly squad: Squad,
    private readonly enemies: EnemySystem,
    private readonly bus: EventBus<GameEvents>,
    private readonly rng: Rng,
  ) {}

  get abilityActive(): boolean {
    return this.enabled && this.abilityTimeLeft > 0;
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.clearEffects();
  }

  update(dt: number, intent: SteerIntent): void {
    if (!this.enabled || this.squad.leader.dead) return;
    this.slashCd -= dt;
    this.abilityCooldownLeft = Math.max(0, this.abilityCooldownLeft - dt);
    this.ringCooldownLeft = Math.max(0, this.ringCooldownLeft - dt);

    this.updateAbility(dt, intent);
    this.updateSlash(dt);
    this.updateRing(dt);
  }

  // ------------------------------------------------------------------ активка

  private updateAbility(dt: number, intent: SteerIntent): void {
    const { squad } = this;
    const cfg = squad.cfg;
    const l = squad.leader;
    if (intent.ability && this.abilityCooldownLeft <= 0 && this.abilityTimeLeft <= 0) {
      this.abilityTimeLeft = cfg.warriorAbilityDuration;
      this.abilityCooldownLeft = cfg.warriorAbilityCooldown;
      this.bus.emit('abilityStart', { x: l.x, y: l.y });
    }
    if (this.abilityTimeLeft <= 0) return;

    this.abilityTimeLeft -= dt;
    if (this.abilityTimeLeft <= 0) {
      this.abilityTimeLeft = 0;
      this.clearAbilityEffects();
      this.bus.emit('abilityEnd', { x: l.x, y: l.y });
      return;
    }
    squad.modifiers.set(MOD_SOURCE, 'damage', cfg.warriorTeamDamageMult);
    squad.modifiers.set(MOD_SOURCE, 'critMult', cfg.warriorTeamCritMult);
    squad.frontGuardHalfArc = (cfg.warriorShieldHalfArcDeg * Math.PI) / 180;

    const list = this.enemies.list;
    const r = cfg.warriorSlowRadius;
    this.enemies.grid.query(l.x, l.y, r + MAX_ENEMY_RADIUS, (j) => {
      const e = list[j]!;
      if (e.dead) return;
      if (Math.hypot(e.x - l.x, e.y - l.y) <= r + ENEMY_DEFS[e.defId]!.radius) this.enemies.slow(e, cfg.warriorSlowMult, 0.25);
    });
  }

  private clearAbilityEffects(): void {
    this.squad.modifiers.clear(MOD_SOURCE);
    this.squad.frontGuardHalfArc = 0;
  }

  // -------------------------------------------------------------------- атака

  /** Розмір хвилі зростає під час активки. */
  private waveScale(): number {
    return this.abilityTimeLeft > 0 ? this.squad.cfg.warriorWaveSizeMult : 1;
  }

  /** Автоатака: хвиля-«U» летить у бік найближчого ворога (будь-куди, не лише вперед). */
  private updateSlash(dt: number): void {
    this.moveWaves(dt);
    if (this.slashCd > 0) return;
    const { squad } = this;
    const cfg = squad.cfg;
    const l = squad.leader;
    const k = this.waveScale();
    const range = cfg.warriorWaveRange * k;

    let best: EnemyState | null = null;
    let bd = Infinity;
    const list = this.enemies.list;
    this.enemies.grid.query(l.x, l.y, range + MAX_ENEMY_RADIUS, (j) => {
      const e = list[j]!;
      if (e.dead) return;
      const d = Math.hypot(e.x - l.x, e.y - l.y);
      if (d <= range + ENEMY_DEFS[e.defId]!.radius && d < bd) {
        bd = d;
        best = e;
      }
    });
    if (!best) return; // кд не тратимо — вдарить, щойно хтось зайде в радіус
    const target = best as EnemyState;

    const dir = Math.atan2(target.y - l.y, target.x - l.x);
    this.waves.push({
      x: l.x,
      y: l.y,
      dir,
      traveled: 0,
      range,
      length: cfg.warriorWaveLength * k,
      halfWidth: (cfg.warriorWaveWidth * k) / 2,
      damage: cfg.warriorWaveDamage,
      hit: new Set(),
      dead: false,
    });
    this.bus.emit('leaderSlash', { x: l.x, y: l.y, heading: dir });
    this.slashCd = cfg.warriorWaveInterval;
  }

  private moveWaves(dt: number): void {
    const { squad } = this;
    const cfg = squad.cfg;
    const list = this.enemies.list;
    for (const w of this.waves) {
      const step = cfg.warriorWaveSpeed * dt;
      w.x += Math.cos(w.dir) * step;
      w.y += Math.sin(w.dir) * step;
      w.traveled += step;
      if (w.traveled >= w.range || collideCircle(squad.world.solids, w.x, w.y, 2)) {
        w.dead = true;
        continue;
      }
      const cx = w.x - Math.cos(w.dir) * (w.length / 2);
      const cy = w.y - Math.sin(w.dir) * (w.length / 2);
      this.enemies.grid.query(cx, cy, w.length / 2 + w.halfWidth + MAX_ENEMY_RADIUS, (j) => {
        const e = list[j]!;
        if (e.dead || w.hit.has(e.id)) return;
        if (waveHits(w, e.x, e.y, ENEMY_DEFS[e.defId]!.radius)) {
          w.hit.add(e.id);
          this.enemies.hurt(e, rollDamage(w.damage, squad, this.rng), w.x, w.y, cfg.warriorWaveKnockback);
        }
      });
    }
    if (this.waves.some((w) => w.dead)) this.waves = this.waves.filter((w) => !w.dead);
  }

  // ------------------------------------------------------------------- кільце

  private updateRing(dt: number): void {
    const { squad } = this;
    const cfg = squad.cfg;
    const l = squad.leader;

    if (this.ringShieldLeft > 0) {
      this.ringShieldLeft -= dt;
      if (this.ringShieldLeft <= 0) {
        this.ringShieldLeft = 0;
        this.clearShields();
      }
    }

    const n = squad.chain.length;
    if (this.ringCooldownLeft > 0 || squad.hasRingGroup() || n < Math.round(cfg.warriorRingMinUnits)) return;
    const tip = squad.chain[n - 1]!;
    if (Math.hypot(tip.x - l.x, tip.y - l.y) >= cfg.leaderRadius + cfg.unitRadius + cfg.warriorRingTouchPad) return;

    squad.startRingGroup(cfg.warriorRingSpacingMult, cfg.warriorRingShieldDuration);
    for (const u of squad.aliveUnits()) u.shield = u.maxHp * cfg.warriorRingShieldFraction;
    l.shield = l.maxHp * cfg.warriorRingShieldFraction;
    this.ringShieldLeft = cfg.warriorRingShieldDuration;
    this.ringCooldownLeft = cfg.warriorRingCooldown;
    this.bus.emit('ringClosed', { x: l.x, y: l.y, count: n });
  }

  private clearShields(): void {
    const { squad } = this;
    squad.leader.shield = 0;
    for (const u of squad.aliveUnits()) u.shield = 0;
    for (const u of squad.fallen) u.shield = 0;
  }

  /** Тогл «вимкнути»: знімає все, що клас навісив. Перезарядки не скидаються. */
  private clearEffects(): void {
    const wasActive = this.abilityTimeLeft > 0;
    this.abilityTimeLeft = 0;
    this.clearAbilityEffects();
    this.ringShieldLeft = 0;
    this.clearShields();
    this.squad.dismissRingGroups();
    this.waves = [];
    if (wasActive) this.bus.emit('abilityEnd', { x: this.squad.leader.x, y: this.squad.leader.y });
  }
}
