export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const deg2rad = (d: number): number => (d * Math.PI) / 180;
export const rad2deg = (r: number): number => (r * 180) / Math.PI;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Приводить кут до діапазону (-π, π]. */
export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
}

export interface SegmentHit {
  /** Параметр уздовж відрізка, 0 = точка A, 1 = точка B. */
  t: number;
  x: number;
  y: number;
  dist: number;
}

/** Найближча до точки (px,py) точка відрізка A–B. */
export function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): SegmentHit {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 < 1e-9 ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  return { t, x, y, dist: Math.hypot(px - x, py - y) };
}
