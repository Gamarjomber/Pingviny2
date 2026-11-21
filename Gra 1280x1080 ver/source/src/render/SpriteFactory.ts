import type Phaser from 'phaser';

type Rect = [x: number, y: number, w: number, h: number, color: string];

/** Спрайт 16×16 з прямокутників (координати в області 14×14) + автоматичний темний контур. */
interface SpriteDef {
  frames: Rect[][];
}

const OUTLINE = '#120d1a';

const RAT = (() => {
  const brown = '#8a5a3c';
  const dark = '#5a3a28';
  const light = '#b98660';
  const pink = '#d99a9a';
  const red = '#ff4040';
  const base: Rect[] = [
    [0, 4, 1, 3, pink], [0, 6, 3, 1, pink], // хвіст
    [3, 5, 7, 5, brown], [3, 5, 7, 1, dark], [4, 9, 5, 1, light], // тулуб
    [9, 5, 4, 4, brown], [12, 6, 2, 2, light], [13, 6, 1, 1, pink], // голова, морда
    [9, 3, 2, 2, dark], [11, 3, 2, 2, dark], // вуха
    [11, 6, 1, 1, red], // око
  ];
  return {
    frames: [
      [...base, [4, 10, 2, 2, dark], [8, 10, 2, 2, dark]],
      [...base, [3, 10, 2, 2, dark], [9, 10, 2, 2, dark]],
    ],
  } satisfies SpriteDef;
})();

const WOLF = (() => {
  const grey = '#6f7080';
  const dark = '#3e3f4c';
  const light = '#a0a2b0';
  const yellow = '#ffd23a';
  const red = '#c0302a';
  const base: Rect[] = [
    [0, 7, 3, 2, dark], // хвіст
    [3, 4, 6, 7, grey], [6, 3, 4, 3, dark], [7, 7, 2, 3, light], // тулуб, грива, груди
    [8, 1, 5, 5, grey], [12, 3, 2, 3, light], [13, 3, 1, 1, dark], [12, 5, 2, 1, red], // голова
    [8, 0, 2, 2, dark], [11, 0, 2, 2, dark], // вуха
    [10, 2, 1, 1, yellow], // око
    [9, 7, 3, 2, grey], [12, 8, 1, 2, light], // лапа з кігтями
  ];
  return {
    frames: [
      [...base, [3, 11, 2, 3, dark], [7, 11, 2, 3, dark]],
      [...base, [4, 11, 2, 3, dark], [8, 11, 2, 3, dark]],
    ],
  } satisfies SpriteDef;
})();

export const SPRITES: Record<string, SpriteDef> = { rat: RAT, wolf: WOLF };

/** Створює текстури enemy_<id> (кадри 0 і 1). */
export function bakeEnemyTextures(scene: Phaser.Scene): void {
  for (const [id, def] of Object.entries(SPRITES)) {
    const key = `enemy_${id}`;
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 16 * def.frames.length, 16)!;
    const ctx = tex.getContext();
    def.frames.forEach((rects, f) => {
      const grid: (string | null)[][] = Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));
      for (const [x, y, w, h, c] of rects) {
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) grid[y + yy + 1]![x + xx + 1] = c;
      }
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let color = grid[y]![x]!;
          if (!color) {
            const touches =
              (grid[y - 1]?.[x] ?? null) || (grid[y + 1]?.[x] ?? null) || (grid[y]?.[x - 1] ?? null) || (grid[y]?.[x + 1] ?? null);
            if (!touches) continue;
            color = OUTLINE;
          }
          ctx.fillStyle = color;
          ctx.fillRect(f * 16 + x, y, 1, 1);
        }
      }
      tex.add(f, 0, f * 16, 0, 16, 16);
    });
    tex.refresh();
  }
}
