export interface Slot {
  x: number;
  y: number;
}

/**
 * Фігура утримання: група прагне кола. 1 — точка, 2 — відрізок,
 * 3 — трикутник, 4 — ромб, далі правильний n-кутник (відстань між сусідами = spacing).
 * Перша вершина — вгору.
 */
export function formationSlots(n: number, spacing: number): Slot[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];
  if (n === 2) return [{ x: -spacing / 2, y: 0 }, { x: spacing / 2, y: 0 }];
  const r = spacing / (2 * Math.sin(Math.PI / n));
  const out: Slot[] = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return out;
}

/**
 * Призначає котам слоти так, щоб порядок у фігурі зберігався (за годинниковою
 * або проти) і сумарний шлях був мінімальним. Повертає індекс слоту для кожного кота.
 */
export function assignSlots(
  positions: readonly { x: number; y: number }[],
  slots: readonly Slot[],
  cx: number,
  cy: number,
): number[] {
  const n = positions.length;
  let bestCost = Infinity;
  let best: number[] = positions.map((_, i) => i);
  for (const dir of [1, -1]) {
    for (let shift = 0; shift < n; shift++) {
      let cost = 0;
      for (let i = 0; i < n; i++) {
        const s = slots[(((shift + dir * i) % n) + n) % n]!;
        const dx = positions[i]!.x - (cx + s.x);
        const dy = positions[i]!.y - (cy + s.y);
        cost += dx * dx + dy * dy;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = positions.map((_, i) => (((shift + dir * i) % n) + n) % n);
      }
    }
  }
  return best;
}
