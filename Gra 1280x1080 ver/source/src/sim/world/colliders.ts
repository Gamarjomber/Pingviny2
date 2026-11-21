import { clamp } from '../../core/math';

export interface RectSolid {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface CircleSolid {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
}
export type Solid = RectSolid | CircleSolid;

export interface Contact {
  /** Нормаль зіткнення — від перешкоди до кола. */
  nx: number;
  ny: number;
  depth: number;
}

function collideRect(s: RectSolid, x: number, y: number, r: number): Contact | null {
  const cx = clamp(x, s.x, s.x + s.w);
  const cy = clamp(y, s.y, s.y + s.h);
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > 1e-9) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // центр усередині прямокутника: виштовхуємо через найближчу грань
  const left = x - s.x;
  const right = s.x + s.w - x;
  const top = y - s.y;
  const bottom = s.y + s.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

function collideCircleSolid(s: CircleSolid, x: number, y: number, r: number): Contact | null {
  const dx = x - s.x;
  const dy = y - s.y;
  const d = Math.hypot(dx, dy);
  const sum = s.r + r;
  if (d >= sum) return null;
  if (d < 1e-6) return { nx: 1, ny: 0, depth: sum };
  return { nx: dx / d, ny: dy / d, depth: sum - d };
}

/** Найглибший контакт кола з набором перешкод (або null). */
export function collideCircle(solids: readonly Solid[], x: number, y: number, r: number): Contact | null {
  let best: Contact | null = null;
  for (const s of solids) {
    const c = s.kind === 'rect' ? collideRect(s, x, y, r) : collideCircleSolid(s, x, y, r);
    if (c && (!best || c.depth > best.depth)) best = c;
  }
  return best;
}

export interface World {
  width: number;
  height: number;
  solids: readonly Solid[];
}
