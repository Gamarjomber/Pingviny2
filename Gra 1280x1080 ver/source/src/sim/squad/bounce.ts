import { clamp, deg2rad, lerp } from '../../core/math';
import type { SquadConfig } from '../../data/squadConfig';

export type BounceConfig = Pick<
  SquadConfig,
  'bounceFullReflectUntilDeg' | 'bouncePerpExitMinDeg' | 'bouncePerpExitMaxDeg'
>;

/**
 * Новий напрямок голови після удару об стіну.
 *
 * Кут рахуємо від ПОВЕРХНІ стіни (α: 0 — ковзання, 90 — удар «буквою Т»).
 *  - α ≤ fullReflectUntil: звичайне відбиття (кут падіння = куту відбиття);
 *  - α → 90°: кут виходу плавно зменшується до 10–15° від стіни.
 * Так голова ніколи не відскакує назад у власний хвіст, а сторону гравець обирає тим,
 * з якого боку від перпендикуляра зайшов. Рівно під 90° сторона випадкова.
 */
export function computeBounceHeading(
  heading: number,
  nx: number,
  ny: number,
  cfg: BounceConfig,
  rng: { next(): number },
): number {
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const tx = -ny;
  const ty = nx;
  const into = clamp(-(hx * nx + hy * ny), 0, 1);
  const alpha = Math.asin(into);
  const tc = hx * tx + hy * ty;
  const side = Math.abs(tc) < 1e-3 ? (rng.next() < 0.5 ? -1 : 1) : Math.sign(tc);

  const full = deg2rad(cfg.bounceFullReflectUntilDeg);
  const perpExit = deg2rad(lerp(cfg.bouncePerpExitMinDeg, cfg.bouncePerpExitMaxDeg, rng.next()));
  const beta =
    alpha <= full ? alpha : lerp(full, perpExit, (alpha - full) / (Math.PI / 2 - full));

  const ex = nx * Math.sin(beta) + tx * side * Math.cos(beta);
  const ey = ny * Math.sin(beta) + ty * side * Math.cos(beta);
  return Math.atan2(ey, ex);
}
