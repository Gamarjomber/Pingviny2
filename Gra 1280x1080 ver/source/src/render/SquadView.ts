import Phaser from 'phaser';
import type { SquadConfig } from '../data/squadConfig';
import { DOWN_TIMERS } from '../data/squadConfig';
import { UNIT_CLASSES } from '../data/unitClasses';
import { catVariant, spriteFrames, spriteKey, spriteScale } from '../data/spriteAssets';
import type { WarriorSystem } from '../sim/leader/WarriorSystem';
import type { Squad } from '../sim/squad/Squad';
import type { UnitState } from '../sim/squad/types';

const LEADER_COLOR = 0xd9b14a;
const OUTLINE = 0x120d1a;
const SHIELD_COLOR = 0x66ccff;

function darken(c: number, k: number): number {
  const r = ((c >> 16) & 255) * k;
  const g = ((c >> 8) & 255) * k;
  const b = (c & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/** Малює відряд простими пікселями. Лише читає стан симуляції. */
export class SquadView {
  private readonly scene: Phaser.Scene;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly dbg: Phaser.GameObjects.Graphics;
  /** Спрайти котів і лідера (пул за id; id лідера = 0). Лише читають стан. */
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private seen = new Set<number>();
  debug = false;

  constructor(
    scene: Phaser.Scene,
    private readonly squad: Squad,
    private readonly warrior?: WarriorSystem,
  ) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(11); // поверх спрайтів: смужки HP, щити, кільця
    this.dbg = scene.add.graphics().setDepth(20);
  }

  draw(): void {
    const { squad, g } = this;
    const cfg = squad.cfg;
    g.clear();
    this.seen = new Set();

    // відчеплені групи: контур фігури і кільце таймера
    for (const grp of squad.groups) {
      g.lineStyle(1, 0x6b5a85, 0.7);
      g.beginPath();
      grp.slots.forEach((s, i) => {
        const x = Math.round(grp.cx + s.x);
        const y = Math.round(grp.cy + s.y);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      if (grp.slots.length > 2) g.closePath();
      g.strokePath();
      const frac = Math.max(0, Math.min(1, grp.timeLeft / (grp.ring ? cfg.warriorRingShieldDuration : cfg.holdDuration)));
      const spacing = cfg.unitSpacing * (grp.ring ? cfg.warriorRingSpacingMult : cfg.holdSpacingMult);
      const ringR = Math.max(spacing, grp.units.length * 2.2) + cfg.unitRadius + 4;
      g.lineStyle(2, frac < 0.3 ? 0xe05050 : 0xd9b14a, 0.9);
      g.beginPath();
      g.arc(grp.cx, grp.cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      g.strokePath();
      for (const u of grp.units) this.drawCat(u, cfg, 0.8);
    }

    // впалі коти: лежать, над ними кільце таймера підйому
    for (const u of squad.fallen) {
      this.drawFallen(u);
    }

    // хвіст — від кінця до голови, щоб голова була зверху
    for (let i = squad.chain.length - 1; i >= 0; i--) this.drawCat(squad.chain[i]!, cfg, 1);
    this.drawLeader(cfg);
    for (const [id, img] of this.sprites) {
      if (!this.seen.has(id)) {
        img.destroy();
        this.sprites.delete(id);
      }
    }

    this.drawDebug(cfg);
  }

  private drawCat(u: UnitState, cfg: SquadConfig, alpha: number): void {
    const g = this.g;
    const color = UNIT_CLASSES[u.classId]?.color ?? 0xffffff;
    const s = Math.round(cfg.unitRadius * 1.7);
    const half = Math.floor(s / 2);
    const x = Math.round(u.x);
    const y = Math.round(u.y);
    const baseSprite = UNIT_CLASSES[u.classId]?.sprite;
    const sprite = baseSprite ? catVariant(baseSprite, u.id) : undefined;
    if (sprite && this.placeSprite(u.id, sprite, u.x, u.y, u.heading, { alpha, depth: 10 - u.id * 0.0001 })) {
      // тіло — спрайт; нижче лише смужка HP і щит
    } else {
      g.fillStyle(OUTLINE, alpha).fillRect(x - half - 1, y - half - 1, s + 2, s + 2);
      g.fillStyle(color, alpha).fillRect(x - half, y - half, s, s);
      g.fillStyle(darken(color, 0.7), alpha);
      g.fillRect(x - half, y - half - 2, 3, 3).fillRect(x + half - 2, y - half - 2, 3, 3); // вуха
      this.drawEyes(x, y, u.heading, alpha);
    }
    this.drawHpTick(x, y - (sprite ? 11 : half + 5), s, u.hp / u.maxHp);
    if (u.shield > 0) g.lineStyle(1, SHIELD_COLOR, 0.35 + 0.5 * Math.min(1, u.shield / (u.maxHp * 0.5))).strokeCircle(x, y, cfg.unitRadius + 2);
  }

  /**
   * Ставить спрайт тіла в пул. Повертає false, якщо такого спрайта немає (тоді малюємо запасний квадрат).
   * Спрайти дивляться вправо; вліво — flipX. Один кадр = легкий підстрибунець, кілька = анімація ходьби.
   */
  private placeSprite(
    id: number,
    name: string,
    x: number,
    y: number,
    heading: number,
    o: { alpha: number; depth?: number; tint?: number; angle?: number; bob?: boolean; flash?: boolean; fps?: number },
  ): boolean {
    const n = spriteFrames(this.scene, name);
    if (n === 0) return false;
    this.seen.add(id);
    let img = this.sprites.get(id);
    if (!img) {
      img = this.scene.add.image(0, 0, spriteKey(name, 0));
      this.sprites.set(id, img);
    }
    const t = this.scene.time.now / 1000;
    const fps = o.fps ?? 7;
    const tick = Math.floor(t * fps + id * 0.37);
    img.setTexture(spriteKey(name, n > 1 ? tick % n : 0));
    const sc = spriteScale(name);
    const bob = n === 1 && o.bob !== false && fps > 0 && tick % 2 === 1 ? (sc < 1 ? -2 * sc : -1) : 0; // 2 пікселі арту
    img.setPosition(sc < 1 ? x : Math.round(x), (sc < 1 ? y : Math.round(y)) + bob); // коти: позиція плавна, округлення — на екранному пікселі (roundPixels)
    const c = Math.cos(heading);
    if (c < -0.05) img.setFlipX(true);
    else if (c > 0.05) img.setFlipX(false);
    img.setAlpha(o.alpha).setDepth(o.depth ?? 10).setAngle(o.angle ?? 0).setScale(sc);
    if (o.flash) {
      img.tintMode = Phaser.TintModes.FILL;
      img.setTint(0xffffff);
    } else if (o.tint !== undefined) {
      img.tintMode = Phaser.TintModes.MULTIPLY;
      img.setTint(o.tint);
    } else {
      img.tintMode = Phaser.TintModes.MULTIPLY;
      img.clearTint();
    }
    return true;
  }

  private drawHpTick(x: number, y: number, w: number, frac: number): void {
    if (frac >= 1) return;
    const g = this.g;
    g.fillStyle(OUTLINE, 0.9).fillRect(x - Math.floor(w / 2) - 1, y - 1, w + 2, 4);
    g.fillStyle(frac < 0.3 ? 0xe05050 : 0x6fcf6f, 1).fillRect(x - Math.floor(w / 2), y, Math.max(1, Math.round(w * frac)), 2);
  }

  private drawFallen(u: UnitState): void {
    const g = this.g;
    const cfg = this.squad.cfg;
    const color = UNIT_CLASSES[u.classId]?.color ?? 0xffffff;
    const s = Math.round(cfg.unitRadius * 1.7);
    const x = Math.round(u.x);
    const y = Math.round(u.y);
    // кіт лежить: приплюснутий, сірий
    const baseSprite = UNIT_CLASSES[u.classId]?.sprite;
    const sprite = baseSprite ? catVariant(baseSprite, u.id) : undefined;
    if (sprite && this.placeSprite(u.id, sprite, u.x, u.y, 0, { alpha: 0.75, tint: 0x6a6a7a, angle: 90, bob: false, depth: 9 })) {
      // лежить спрайтом на боці, сірий
    } else {
      g.fillStyle(OUTLINE, 0.9).fillRect(x - s / 2 - 1, y - 2, s + 2, 7);
      g.fillStyle(darken(color, 0.45), 1).fillRect(x - s / 2, y - 1, s, 5);
      g.fillStyle(0xe05050, 1).fillRect(x - 2, y, 1, 1).fillRect(x + 1, y, 1, 1);
    }
    const max = DOWN_TIMERS[Math.max(0, u.downs - 1)] ?? 1;
    const frac = Math.max(0, u.downTimeLeft / max);
    g.lineStyle(2, frac < 0.35 ? 0xe05050 : 0xd9b14a, 0.95).beginPath();
    g.arc(x, y + 1, cfg.unitRadius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    g.strokePath();
  }

  private drawLeader(cfg: SquadConfig): void {
    const g = this.g;
    const l = this.squad.leader;
    const s = Math.round(cfg.leaderRadius * 1.7);
    const half = Math.floor(s / 2);
    const x = Math.round(l.x);
    const y = Math.round(l.y);
    const dashing = l.dashTimeLeft > 0;
    const hasSprite = this.placeSprite(0, 'warrior', l.x, l.y, l.heading, { alpha: 1, depth: 10.5, flash: dashing, fps: l.speed > 5 ? 8 : 0 });
    if (!hasSprite) {
      g.fillStyle(dashing ? 0xffffff : OUTLINE, 1).fillRect(x - half - 2, y - half - 2, s + 4, s + 4);
      g.fillStyle(LEADER_COLOR, 1).fillRect(x - half - 1, y - half - 1, s + 2, s + 2);
      g.fillStyle(0xf2dc8a, 1).fillRect(x - half, y - half, s, s);
      g.fillStyle(0xb98f2e, 1);
      g.fillRect(x - half - 1, y - half - 3, 3, 3).fillRect(x + half - 1, y - half - 3, 3, 3);
      this.drawEyes(x, y, l.heading, 1);
    }
    this.drawHpTick(x, y - (hasSprite ? 13 : half + 6), s + 4, l.hp / l.maxHp);
    if (l.shield > 0) g.lineStyle(1, SHIELD_COLOR, 0.35 + 0.5 * Math.min(1, l.shield / (l.maxHp * 0.5))).strokeCircle(x, y, cfg.leaderRadius + 3);
    // передній щит активки Воїна: дуга перед головою
    if (this.warrior?.abilityActive) {
      const half2 = this.squad.frontGuardHalfArc;
      g.lineStyle(2, SHIELD_COLOR, 0.95).beginPath();
      g.arc(l.x, l.y, cfg.leaderRadius + 7, l.heading - half2, l.heading + half2, false);
      g.strokePath();
      g.lineStyle(1, 0xffffff, 0.6).beginPath();
      g.arc(l.x, l.y, cfg.leaderRadius + 9, l.heading - half2, l.heading + half2, false);
      g.strokePath();
    }
    // індикатор перезарядки ривка: тонка дуга під головою
    if (l.dashCooldownLeft > 0) {
      const f = 1 - l.dashCooldownLeft / cfg.dashCooldown;
      g.lineStyle(1, 0x8fd1ff, 0.8).beginPath();
      g.arc(x, y, cfg.leaderRadius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
      g.strokePath();
    }
  }

  private drawEyes(x: number, y: number, heading: number, alpha: number): void {
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    const px = -dy;
    const py = dx;
    this.g.fillStyle(OUTLINE, alpha);
    for (const sgn of [-1, 1]) {
      this.g.fillRect(Math.round(x + dx * 2 + px * 2 * sgn), Math.round(y + dy * 2 + py * 2 * sgn), 1, 1);
    }
  }

  private drawDebug(cfg: SquadConfig): void {
    const d = this.dbg;
    d.clear();
    if (!this.debug) return;
    const { squad } = this;
    const l = squad.leader;
    const first = Math.max(1, Math.round(cfg.splitFirstDetachableIndex) - 1);

    // шлях справжньої голови (rawHead) — тонка сіра лінія
    const hp = squad.headPath;
    if (hp.length > 1) {
      d.lineStyle(1, 0x888888, 0.6);
      d.beginPath();
      d.moveTo(hp[0]!.x, hp[0]!.y);
      for (let i = 1; i < hp.length; i++) d.lineTo(hp[i]!.x, hp[i]!.y);
      d.strokePath();
    }
    // згладжений слід (рейки) — жовта лінія: голова → перо → старі точки
    const tp = squad.trail.points();
    d.lineStyle(1, 0xffee33, 0.95);
    d.beginPath();
    d.moveTo(l.x, l.y);
    for (let i = tp.xs.length - 1; i >= 0 && i >= tp.xs.length - 400; i--) d.lineTo(tp.xs[i]!, tp.ys[i]!);
    d.strokePath();
    // верьовка: коло LAZY_RADIUS навколо голови і перо
    d.lineStyle(1, 0x33ddff, 0.8).strokeCircle(l.x, l.y, squad.lazyRadius());
    d.fillStyle(0x33ddff, 1).fillRect(Math.round(squad.pen.x) - 1, Math.round(squad.pen.y) - 1, 2, 2);
    // коти — точки в центрах
    squad.chain.forEach((u) => d.fillStyle(0xffffff, 1).fillRect(Math.round(u.x), Math.round(u.y), 1, 1));
    d.lineStyle(1, 0xffffff, 0.9).strokeCircle(l.x, l.y, cfg.leaderRadius);
    d.lineStyle(1, 0xff5577, 0.6).strokeCircle(l.x, l.y, cfg.leaderRadius + cfg.splitLinkHitRadius);
    // курсор напрямку
    d.lineStyle(1, 0xffffff, 0.5).lineBetween(l.x, l.y, l.x + Math.cos(l.heading) * 30, l.y + Math.sin(l.heading) * 30);

    let prev: { x: number; y: number } = l;
    squad.chain.forEach((u, i) => {
      d.lineStyle(1, 0xffffff, 0.35).strokeCircle(u.x, u.y, cfg.unitRadius);
      // «безпечні» коти біля голови — червоні, відчіпні ланки — зелені
      const eligible = i >= first;
      d.lineStyle(eligible ? 2 : 1, eligible ? 0x55ff88 : 0xff5555, eligible ? 0.9 : 0.5).lineBetween(prev.x, prev.y, u.x, u.y);
      prev = u;
    });
    for (const g of squad.groups) {
      g.slots.forEach((s) => d.lineStyle(1, 0x55aaff, 0.8).strokeCircle(g.cx + s.x, g.cy + s.y, 2));
    }
    for (const s of squad.world.solids) {
      d.lineStyle(1, 0xffaa00, 0.6);
      if (s.kind === 'rect') d.strokeRect(s.x, s.y, s.w, s.h);
      else d.strokeCircle(s.x, s.y, s.r);
    }
  }
}
