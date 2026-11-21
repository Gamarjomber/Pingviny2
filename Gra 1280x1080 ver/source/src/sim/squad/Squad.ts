import type { EventBus } from '../../core/EventBus';
import { ModifierStack } from '../../core/Modifiers';
import type { Rng } from '../../core/Rng';
import { TAU, clamp, closestOnSegment, wrapAngle } from '../../core/math';
import { DOWN_TIMERS, type SquadConfig } from '../../data/squadConfig';
import { UNIT_CLASSES } from '../../data/unitClasses';
import type { GameEvents } from '../events';
import type { SteerIntent } from '../intent';
import { collideCircle, type World } from '../world/colliders';
import { computeBounceHeading } from './bounce';
import { assignSlots, formationSlots } from './formation';
import { Trail } from './Trail';
import type { HoldGroup, LeaderState, UnitState } from './types';

export type SquadModifierKey = 'speed' | 'turn' | 'damage' | 'critMult';

/**
 * Як рухається хвіст:
 *  - 'trail'   — велосипедний ланцюг: кожна ланка йде по сліду голови;
 *  - 'pursuit' — кожен кіт тягнеться за тим, хто перед ним (як мотузка): зрізає кути.
 */
export type ChainMode = 'trail' | 'pursuit';

/**
 * Відряд (Squad): лідер + хвіст-ланцюг + відчеплені групи + впалі коти.
 * Чиста симуляція без Phaser. cfg передається за посиланням, тож його можна крутити наживо.
 *
 * Хвіст — велосипедний ланцюг: ланки на жорсткій відстані одна від одної, і кожна
 * проходить точно по сліду голови. Не мотузка: не тягнеться, не провисає, не зрізає кути.
 */
export class Squad {
  readonly leader: LeaderState;
  readonly chain: UnitState[] = [];
  readonly groups: HoldGroup[] = [];
  /** Коти на 0 HP: нічого не роблять, але їх можна підібрати, поки йде таймер. */
  readonly fallen: UnitState[] = [];
  readonly modifiers = new ModifierStack<SquadModifierKey>();
  readonly trail = new Trail();
  /** Налагодження: лідер не отримує урону. */
  godMode = false;
  chainMode: ChainMode = 'trail';

  /** Півкут переднього щита лідера (рад). 0 — щита немає. Виставляє клас лідера. */
  frontGuardHalfArc = 0;
  private nextUnitId = 1;
  private nextGroupId = 1;
  private splitCooldownLeft = 0;
  private pinX: number[] = [];
  private pinY: number[] = [];
  private pinH: number[] = [];
  /** Перо стабілізатора: тягнеться за головою на верьовці, по ньому пишеться слід хвоста. */
  readonly pen = { x: 0, y: 0 };
  /** Для налагодження: шлях справжньої голови (rawHead). */
  readonly headPath: { x: number; y: number }[] = [];
  /** Налагодження: скільки разів довелося виштовхувати кота зі стіни / підтягувати перо до голови. */
  railWallPushes = 0;
  penGuardHits = 0;
  /** Накопичений поворот на межі радіуса (рад): з нього росте спіраль. */
  private turnAccum = 0;
  private turnSign = 0;

  constructor(
    readonly cfg: SquadConfig,
    readonly world: World,
    readonly bus: EventBus<GameEvents>,
    readonly rng: Rng,
    spawn: { x: number; y: number; heading: number },
  ) {
    this.leader = {
      x: spawn.x,
      y: spawn.y,
      heading: spawn.heading,
      speed: cfg.leaderSpeed,
      hp: cfg.leaderMaxHp,
      maxHp: cfg.leaderMaxHp,
      dead: false,
      dashTimeLeft: 0,
      dashCooldownLeft: 0,
      shield: 0,
    };
    this.pen.x = spawn.x;
    this.pen.y = spawn.y;
    this.trail.seedStraight(spawn.x, spawn.y, spawn.heading, 800, cfg.trailResampleStep);
  }

  /** Невразливість лідера (під час ривка). */
  get invulnerable(): boolean {
    return this.leader.dashTimeLeft > 0;
  }

  /** Усі живі коти, які можуть діяти: у хвості і у відчеплених групах. */
  aliveUnits(): UnitState[] {
    const out = this.chain.slice();
    for (const g of this.groups) for (const u of g.units) out.push(u);
    return out;
  }

  /** Новий кіт встає в кінець хвоста. */
  addUnit(classId: string, maxHp?: number): UnitState {
    const hp = maxHp ?? UNIT_CLASSES[classId]?.maxHp ?? 100;
    const u: UnitState = {
      id: this.nextUnitId++,
      classId,
      x: this.leader.x,
      y: this.leader.y,
      heading: this.leader.heading,
      hp,
      maxHp: hp,
      mode: 'chain',
      groupId: null,
      slot: 0,
      downs: 0,
      downTimeLeft: 0,
      atkCd: this.rng.range(0, 0.5),
      shield: 0,
      unsettled: false,
    };
    this.chain.push(u);
    this.placeChain();
    const i = this.chain.length - 1;
    u.x = this.pinX[i]!;
    u.y = this.pinY[i]!;
    u.heading = this.pinH[i]!;
    return u;
  }

  removeLastUnit(): UnitState | undefined {
    return this.chain.pop();
  }

  // ------------------------------------------------------------ урон і падіння

  damageUnit(u: UnitState, amount: number): void {
    if (u.mode === 'down' || amount <= 0) return;
    if (u.shield > 0) {
      const absorbed = Math.min(u.shield, amount);
      u.shield -= absorbed;
      amount -= absorbed;
      this.bus.emit('blocked', { x: u.x, y: u.y, amount: absorbed, kind: 'absorb' });
      if (amount <= 0) return;
    }
    u.hp = Math.max(0, u.hp - amount);
    this.bus.emit('damage', { x: u.x, y: u.y, amount, kind: 'unit' });
    if (u.hp <= 0) this.knockDown(u);
  }

  /**
   * Повертає true, якщо удар «прийнято» (урон пройшов або його погасив щит) — ворог відскакує.
   * Під час ривка лідер невразливий. fromX/fromY — звідки удар: потрібні для переднього щита.
   */
  damageLeader(amount: number, fromX?: number, fromY?: number): boolean {
    const l = this.leader;
    if (l.dead || this.godMode || this.invulnerable || amount <= 0) return false;
    if (this.frontGuardHalfArc > 0 && fromX !== undefined && fromY !== undefined) {
      const diff = Math.abs(wrapAngle(Math.atan2(fromY - l.y, fromX - l.x) - l.heading));
      if (diff <= this.frontGuardHalfArc) {
        this.bus.emit('blocked', { x: l.x, y: l.y, amount, kind: 'front' });
        return true;
      }
    }
    if (l.shield > 0) {
      const absorbed = Math.min(l.shield, amount);
      l.shield -= absorbed;
      amount -= absorbed;
      this.bus.emit('blocked', { x: l.x, y: l.y, amount: absorbed, kind: 'absorb' });
      if (amount <= 0) return true;
    }
    l.hp = Math.max(0, l.hp - amount);
    this.bus.emit('damage', { x: l.x, y: l.y, amount, kind: 'leader' });
    if (l.hp <= 0) {
      l.dead = true;
      this.bus.emit('gameOver', { x: l.x, y: l.y });
    }
    return true;
  }

  healUnit(u: UnitState, amount: number): void {
    if (u.mode === 'down') return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (u.hp > before) this.bus.emit('heal', { x: u.x, y: u.y, amount: u.hp - before });
  }

  healLeader(amount: number): void {
    const l = this.leader;
    const before = l.hp;
    l.hp = Math.min(l.maxHp, l.hp + amount);
    if (l.hp > before) this.bus.emit('heal', { x: l.x, y: l.y, amount: l.hp - before });
  }

  /** Кіт на 0 HP вилітає з хвоста (або групи) і лежить із таймером. Ланцюг за ним зімкнеться. */
  private knockDown(u: UnitState): void {
    const ci = this.chain.indexOf(u);
    if (ci >= 0) this.chain.splice(ci, 1);
    else {
      for (let gi = 0; gi < this.groups.length; gi++) {
        const g = this.groups[gi]!;
        const i = g.units.indexOf(u);
        if (i >= 0) {
          g.units.splice(i, 1);
          if (g.units.length === 0) this.groups.splice(gi, 1);
          break;
        }
      }
    }
    u.groupId = null;
    u.downs++;
    const timer = DOWN_TIMERS[u.downs - 1];
    if (timer === undefined) {
      this.bus.emit('unitDied', { unitId: u.id, classId: u.classId, x: u.x, y: u.y });
      return;
    }
    u.mode = 'down';
    u.downTimeLeft = timer;
    this.fallen.push(u);
    this.bus.emit('unitDown', { unitId: u.id, classId: u.classId, x: u.x, y: u.y, timer });
  }

  /** Голова торкається впалого — він повертається в кінець хвоста з мінімумом HP. */
  private updateFallen(dt: number): void {
    const l = this.leader;
    const reach = this.cfg.leaderRadius + this.cfg.unitRadius + this.cfg.rejoinPad;
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      const u = this.fallen[i]!;
      u.downTimeLeft -= dt;
      if (u.downTimeLeft <= 0) {
        this.fallen.splice(i, 1);
        this.bus.emit('unitDied', { unitId: u.id, classId: u.classId, x: u.x, y: u.y });
      } else if (Math.hypot(u.x - l.x, u.y - l.y) < reach) {
        this.fallen.splice(i, 1);
        u.mode = 'chain';
        u.hp = Math.max(1, Math.round(u.maxHp * this.cfg.reviveHpFraction));
        this.chain.push(u);
        this.markRejoined([u]);
        this.bus.emit('unitRevived', { unitId: u.id, classId: u.classId, hp: u.hp });
      }
    }
  }

  // ------------------------------------------------------------------- цикл

  update(dt: number, intent: SteerIntent): void {
    this.splitCooldownLeft = Math.max(0, this.splitCooldownLeft - dt);
    const rg = this.ringGroupOfLeader();
    if (rg && intent.dash && rg.age > 0.5) this.dismissRingGroups(); // ривок — вирватись з кільця
    this.updateAbilities(dt, intent);
    this.moveLeader(dt, intent);
    this.updatePen(dt);
    this.followChain(dt);
    this.updateGroups(dt);
    this.updateFallen(dt);
    this.checkSplit();
    this.checkRejoin();
  }

  private updateAbilities(dt: number, intent: SteerIntent): void {
    const l = this.leader;
    l.dashTimeLeft = Math.max(0, l.dashTimeLeft - dt);
    l.dashCooldownLeft = Math.max(0, l.dashCooldownLeft - dt);
    if (intent.dash && l.dashCooldownLeft <= 0 && l.dashTimeLeft <= 0) {
      l.dashTimeLeft = this.cfg.dashDuration;
      l.dashCooldownLeft = this.cfg.dashCooldown;
      this.bus.emit('dash', { x: l.x, y: l.y });
    }
    this.modifiers.set('dash', 'speed', l.dashTimeLeft > 0 ? this.cfg.dashSpeedMult : 1);
    this.modifiers.set('brake', 'speed', intent.brake ? this.cfg.brakeSpeedMult : 1);
  }

  // -------------------------------------------------------------------- лідер

  /** Мін. радіус розвороту голови: росте з довжиною хвоста і зі спіраллю безперервного повороту. */
  minTurnRadius(): number {
    const cfg = this.cfg;
    const loops = Math.min(this.turnAccum, TAU * 8) / TAU;
    return (cfg.minTurnRadiusBase + cfg.minTurnRadiusPerUnit * this.chain.length) * (1 + cfg.spiralGrowth * loops);
  }

  /** Довжина верьовки: базовий + на кота, але не більше частки радіуса розвороту (інакше хвіст збіжиться в центр). */
  lazyRadius(): number {
    const cfg = this.cfg;
    const r = cfg.lazyBaseRadius + cfg.lazyPerUnitRadius * this.chain.length;
    return Math.min(r, cfg.lazyMaxTurnFraction * this.minTurnRadius());
  }

  /** Лідер у кільці: стоїть у своєму слоті разом із котами, може лише повертатись (цілитись щитом). */
  private holdLeaderInRing(rg: HoldGroup, dt: number, intent: SteerIntent): void {
    const l = this.leader;
    const cfg = this.cfg;
    const turn = 6 * dt;
    if (intent.targetAngle !== null) l.heading = wrapAngle(l.heading + clamp(wrapAngle(intent.targetAngle - l.heading), -turn, turn));
    else l.heading = wrapAngle(l.heading + clamp(intent.turnAxis, -1, 1) * turn);
    const s = rg.slots[rg.leaderSlot!]!;
    this.moveToward(l, rg.cx + s.x, rg.cy + s.y, cfg.holdMoveSpeed * dt);
    this.resolveLeaderCollisions();
    l.speed = 0;
    this.recordHeadPath();
  }

  private moveLeader(dt: number, intent: SteerIntent): void {
    const l = this.leader;
    const cfg = this.cfg;
    const rg = this.ringGroupOfLeader();
    if (rg) {
      this.holdLeaderInRing(rg, dt, intent);
      return;
    }
    l.speed = cfg.leaderSpeed * this.modifiers.get('speed');
    // Швидкість повороту = швидкість / мін. радіус: радіус розвороту, а не кутова швидкість, — властивість голови.
    const rate = Math.min((cfg.turnRateDeg * Math.PI) / 180, l.speed / this.minTurnRadius());
    const maxTurn = rate * this.modifiers.get('turn') * dt;
    let delta: number;
    if (intent.targetAngle !== null) {
      delta = clamp(wrapAngle(intent.targetAngle - l.heading), -maxTurn, maxTurn);
    } else {
      delta = clamp(intent.turnAxis, -1, 1) * maxTurn;
    }
    l.heading = wrapAngle(l.heading + delta);
    this.accumulateSpiral(delta, maxTurn, dt);

    // Підкроки: на ривку не пролетіти крізь тонку стіну, і слід лишається гладким.
    const dist = l.speed * dt;
    const steps = Math.max(1, Math.ceil(dist / Math.min(cfg.leaderRadius * 0.5, 2)));
    const sub = dist / steps;
    for (let s = 0; s < steps; s++) {
      l.x += Math.cos(l.heading) * sub;
      l.y += Math.sin(l.heading) * sub;
      this.resolveLeaderCollisions();
    }
    this.recordHeadPath();
  }

  /**
   * Анти-уроборос: якщо голова безперервно крутиться на межі радіуса, цей радіус повільно росте.
   * Ровне коло тримати не вдається — виходить спіраль, що розширюється. Відпустив поворот — радіус повертається.
   */
  private accumulateSpiral(delta: number, maxTurn: number, dt: number): void {
    if (maxTurn > 1e-9 && Math.abs(delta) >= 0.9 * maxTurn) {
      const sign = Math.sign(delta);
      if (sign !== this.turnSign) {
        this.turnSign = sign;
        this.turnAccum = 0;
      }
      this.turnAccum += Math.abs(delta);
    } else {
      this.turnAccum *= Math.exp(-this.cfg.spiralDecay * dt);
    }
  }

  private recordHeadPath(): void {
    const l = this.leader;
    const last = this.headPath[this.headPath.length - 1];
    if (!last || Math.hypot(l.x - last.x, l.y - last.y) >= 2) {
      this.headPath.push({ x: l.x, y: l.y });
      if (this.headPath.length > 600) this.headPath.shift();
    }
  }

  private resolveLeaderCollisions(): void {
    const l = this.leader;
    for (let pass = 0; pass < 3; pass++) {
      const c = collideCircle(this.world.solids, l.x, l.y, this.cfg.leaderRadius);
      if (!c) return;
      l.x += c.nx * c.depth;
      l.y += c.ny * c.depth;
      const into = Math.cos(l.heading) * c.nx + Math.sin(l.heading) * c.ny;
      if (into < 0) {
        l.heading = computeBounceHeading(l.heading, c.nx, c.ny, this.cfg, this.rng);
        this.bus.emit('bounce', { x: l.x, y: l.y, nx: c.nx, ny: c.ny, angle: l.heading });
      }
    }
  }

  // ------------------------------------------------------------------- хвіст

  /** Усі коти, які можуть повернутися в хвіст (хвіст, групи, впалі) — для довжини сліду. */
  private trackedUnitCount(): number {
    let n = this.chain.length + this.fallen.length;
    for (const g of this.groups) n += g.units.length;
    return n;
  }

  /**
   * Стабілізатор голови (lazy brush). Перо привʼязане до голови верьовкою: поки голова
   * в радіусі, перо стоїть; вийшла — перо підтягується на відстань LAZY_RADIUS, плюс згладжування за dt.
   * Голову малюємо в rawHead, згладжується лише слід для хвоста.
   */
  private updatePen(dt: number): void {
    const cfg = this.cfg;
    const h = this.leader;
    const pen = this.pen;
    const R = this.lazyRadius();
    const dx = pen.x - h.x;
    const dy = pen.y - h.y;
    const d = Math.hypot(dx, dy);
    const tx = d > R && d > 1e-9 ? h.x + (dx / d) * R : pen.x;
    const ty = d > R && d > 1e-9 ? h.y + (dy / d) * R : pen.y;
    const k = 1 - Math.exp(-cfg.lazySmoothing * dt);
    let nx = pen.x + (tx - pen.x) * k;
    let ny = pen.y + (ty - pen.y) * k;

    // Стіни: згладжений слід не має зрізати кут. Якщо відрізок пера (або верьовка до голови)
    // зачіпає перешкоду — пишемо ближче до rawHead.
    if (!this.segmentClear(pen.x, pen.y, nx, ny) || !this.segmentClear(nx, ny, h.x, h.y)) {
      this.penGuardHits++;
      for (const t of [0.5, 0.75, 1]) {
        const cx = nx + (h.x - nx) * t;
        const cy = ny + (h.y - ny) * t;
        if (this.segmentClear(pen.x, pen.y, cx, cy) && this.segmentClear(cx, cy, h.x, h.y)) {
          nx = cx;
          ny = cy;
          break;
        }
        nx = h.x;
        ny = h.y;
      }
    }
    pen.x = nx;
    pen.y = ny;
    this.trail.setPen(nx, ny, cfg.trailResampleStep);
    this.trail.trimTo((this.trackedUnitCount() + 2) * cfg.unitSpacing);
  }

  /** Вільний від перешкод відрізок для кота (з радіусом unitRadius). */
  private segmentClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const r = this.cfg.unitRadius;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / (r * 0.5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (collideCircle(this.world.solids, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)) return false;
    }
    return true;
  }

  /** Рейки: i-й кіт на відстані (i+1)*SPACING вздовж шляху голова → перо → слід. */
  private placeChain(): void {
    const l = this.leader;
    this.trail.place(l.x, l.y, this.chain.length, this.cfg.unitSpacing, this.pinX, this.pinY, this.pinH);
  }

  /** Страховка: кіт у перешкоді виштовхується по нормалі (рейки перераховуються щокадру, тож це 1 кадр). */
  private pushChainOutOfSolids(): void {
    for (const u of this.chain) {
      const c = collideCircle(this.world.solids, u.x, u.y, this.cfg.unitRadius);
      if (c) {
        this.railWallPushes++;
        u.x += c.nx * c.depth;
        u.y += c.ny * c.depth;
      }
    }
  }

  /**
   * Формація-«кільце»: увесь хвіст стає групою на місці — як відкушена група, але з більшою відстанню
   * між котами, і вони не рухаються (лише займають слоти). Через duration група повертається в хвіст.
   */
  startRingGroup(spacingMult: number, duration: number): void {
    const detached = this.chain.splice(0);
    if (detached.length === 0) return;
    const l = this.leader;
    const all = [...detached, l]; // лідер — теж учасник формації
    let cx = 0;
    let cy = 0;
    for (const u of all) {
      cx += u.x;
      cy += u.y;
    }
    cx /= all.length;
    cy /= all.length;
    const slots = formationSlots(all.length, this.cfg.unitSpacing * spacingMult);
    const order = assignSlots(all, slots, cx, cy);
    const group: HoldGroup = {
      id: this.nextGroupId++, units: detached, cx, cy, slots, timeLeft: duration, age: 0, ring: true,
      leaderSlot: order[detached.length]!,
    };
    detached.forEach((u, i) => {
      u.mode = 'hold';
      u.groupId = group.id;
      u.slot = order[i]!;
    });
    this.groups.push(group);
  }

  /** Група-кільце, у якій стоїть лідер (він тоді нерухомий). */
  ringGroupOfLeader(): HoldGroup | undefined {
    return this.groups.find((g) => g.ring && g.leaderSlot !== undefined);
  }

  /** Повертає всі групи-кільця в кінець хвоста (кінець дії щита або вимкнення класу). */
  dismissRingGroups(): void {
    for (let gi = this.groups.length - 1; gi >= 0; gi--) {
      const g = this.groups[gi]!;
      if (!g.ring) continue;
      this.groups.splice(gi, 1);
      this.returnToChain(g);
    }
  }

  /**
   * Повернулись у хвіст: поки біжать на своє місце (часто крізь голову), їхні ланки не відкушуються,
   * і ще діє пауза відкусу. Інакше щойно підібрані коти одразу відчіплювались би знову.
   */
  private markRejoined(units: readonly UnitState[]): void {
    for (const u of units) u.unsettled = true;
    this.splitCooldownLeft = Math.max(this.splitCooldownLeft, this.cfg.rejoinSplitCooldown);
  }

  hasRingGroup(): boolean {
    return this.groups.some((g) => g.ring);
  }

  private returnToChain(g: HoldGroup): void {
    // у порядку слотів по колу найближчий до голови стає першим, щоб хвіст не плутався
    const l = this.leader;
    const units = g.units.slice().sort((a, b) => Math.hypot(a.x - l.x, a.y - l.y) - Math.hypot(b.x - l.x, b.y - l.y));
    for (const u of units) {
      u.mode = 'chain';
      u.groupId = null;
      this.chain.push(u);
    }
    this.markRejoined(units);
    this.bus.emit('rejoin', { groupId: g.id, count: g.units.length });
  }

  /**
   * Режим 'trail' (за замовчуванням): коти не рулять самі, а лише займають свою позицію на рейках.
   * Далеко від свого місця (пересборка, підйом, хтось випав із середини) кіт біжить до нього зі
   * швидкістю catchUpSpeedMult і зсідає в хвіст.
   */
  private followChain(dt: number): void {
    const n = this.chain.length;
    if (n === 0) return;
    const cfg = this.cfg;
    const l = this.leader;
    const maxStep = Math.max(l.speed, cfg.leaderSpeed) * cfg.catchUpSpeedMult * dt;
    if (this.chainMode === 'pursuit') {
      this.followPursuit(maxStep);
      let prev: { x: number; y: number } = l;
      for (const u of this.chain) {
        if (u.unsettled && Math.hypot(u.x - prev.x, u.y - prev.y) < cfg.unitSpacing * 1.3) u.unsettled = false;
        prev = u;
      }
    } else {
      this.placeChain();
      for (let i = 0; i < n; i++) {
        const u = this.chain[i]!;
        this.moveToward(u, this.pinX[i]!, this.pinY[i]!, maxStep);
        u.heading = this.pinH[i]!;
        if (u.unsettled && Math.hypot(u.x - this.pinX[i]!, u.y - this.pinY[i]!) < 2) u.unsettled = false;
      }
    }
    this.pushChainOutOfSolids();
  }

  /** Кожен кіт тримає відстань unitSpacing до попереднього і тягнеться прямо до нього. */
  private followPursuit(maxStep: number): void {
    const spacing = this.cfg.unitSpacing;
    let prev: { x: number; y: number } = this.leader;
    for (const u of this.chain) {
      const dx = u.x - prev.x;
      const dy = u.y - prev.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) {
        const tx = prev.x + (dx / d) * spacing;
        const ty = prev.y + (dy / d) * spacing;
        this.moveToward(u, tx, ty, maxStep);
        u.heading = Math.atan2(prev.y - u.y, prev.x - u.x);
      }
      prev = u;
    }
  }

  private moveToward(u: { x: number; y: number }, tx: number, ty: number, maxStep: number): void {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= maxStep) {
      u.x = tx;
      u.y = ty;
    } else {
      u.x += (dx / d) * maxStep;
      u.y += (dy / d) * maxStep;
    }
  }

  // ------------------------------------------------------------------- відкус

  /**
   * Split: голова проходить МІЖ двома котами хвоста. Перевіряємо перетин голови з ланками
   * після перших (firstDetachable-1) котів. Дотик до кінчика останнього кота — не Split,
   * тому точка контакту має бути всередині ланки, а не на самому коті.
   */
  checkSplit(): void {
    if (this.splitCooldownLeft > 0) return;
    const cfg = this.cfg;
    const l = this.leader;
    const first = Math.max(1, Math.round(cfg.splitFirstDetachableIndex) - 1);
    const reach = cfg.leaderRadius + cfg.splitLinkHitRadius;
    for (let j = first; j < this.chain.length; j++) {
      const a = this.chain[j - 1]!;
      const b = this.chain[j]!;
      if (a.unsettled || b.unsettled) continue; // щойно підібраний кіт ще біжить на місце
      const hit = closestOnSegment(l.x, l.y, a.x, a.y, b.x, b.y);
      if (hit.t > 0.05 && hit.t < 0.95 && hit.dist < reach) {
        this.splitAt(j);
        return;
      }
    }
  }

  private splitAt(j: number): void {
    const detached = this.chain.splice(j);
    if (detached.length === 0) return;
    for (const u of detached) u.unsettled = false;
    const cfg = this.cfg;
    let cx = 0;
    let cy = 0;
    for (const u of detached) {
      cx += u.x;
      cy += u.y;
    }
    cx /= detached.length;
    cy /= detached.length;

    const slots = formationSlots(detached.length, cfg.unitSpacing * cfg.holdSpacingMult);
    const order = assignSlots(detached, slots, cx, cy);
    const group: HoldGroup = {
      id: this.nextGroupId++,
      units: detached,
      cx,
      cy,
      slots,
      timeLeft: cfg.holdDuration,
      age: 0,
    };
    detached.forEach((u, i) => {
      u.mode = 'hold';
      u.groupId = group.id;
      u.slot = order[i]!;
    });
    this.groups.push(group);
    this.splitCooldownLeft = cfg.splitCooldown;
    this.bus.emit('split', { groupId: group.id, count: detached.length, x: cx, y: cy });
  }

  // -------------------------------------------------- фігура утримання і підбір

  private updateGroups(dt: number): void {
    const cfg = this.cfg;
    for (let gi = this.groups.length - 1; gi >= 0; gi--) {
      const g = this.groups[gi]!;
      g.age += dt;
      g.timeLeft -= dt;
      if (g.timeLeft <= 0 && g.ring) {
        this.groups.splice(gi, 1);
        this.returnToChain(g);
        continue;
      }
      if (g.timeLeft <= 0) {
        this.groups.splice(gi, 1);
        for (const u of g.units) this.bus.emit('unitDied', { unitId: u.id, classId: u.classId, x: u.x, y: u.y });
        this.bus.emit('holdExpired', { groupId: g.id, count: g.units.length, x: g.cx, y: g.cy });
        continue;
      }
      for (const u of g.units) {
        const s = g.slots[u.slot]!;
        const dx = g.cx + s.x - u.x;
        const dy = g.cy + s.y - u.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.5) {
          const step = Math.min(d, cfg.holdMoveSpeed * dt);
          u.x += (dx / d) * step;
          u.y += (dy / d) * step;
          u.heading = Math.atan2(dy, dx);
        }
      }
    }
  }

  /** Rejoin: голова торкається відчепленої групи — група встає в кінець хвоста. */
  checkRejoin(): void {
    const l = this.leader;
    const reach = this.cfg.leaderRadius + this.cfg.unitRadius + this.cfg.rejoinPad;
    for (let gi = 0; gi < this.groups.length; gi++) {
      const g = this.groups[gi]!;
      if (g.ring || g.age < this.cfg.rejoinGrace) continue;
      if (!g.units.some((u) => Math.hypot(u.x - l.x, u.y - l.y) < reach)) continue;
      this.groups.splice(gi, 1);
      for (const u of g.units) {
        u.mode = 'chain';
        u.groupId = null;
        this.chain.push(u);
      }
      this.markRejoined(g.units);
      this.bus.emit('rejoin', { groupId: g.id, count: g.units.length });
      return;
    }
  }
}
