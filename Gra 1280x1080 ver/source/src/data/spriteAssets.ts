import { ART_PX_PER_WORLD } from '../game/constants';
import type Phaser from 'phaser';
import knight from '../assets/sprites/knight_0.png?inline';
import knightV1 from '../assets/sprites/knight_v1_0.png?inline';
import knightV2 from '../assets/sprites/knight_v2_0.png?inline';
import swordsman from '../assets/sprites/swordsman_0.png?inline';
import swordsmanV1 from '../assets/sprites/swordsman_v1_0.png?inline';
import swordsmanV2 from '../assets/sprites/swordsman_v2_0.png?inline';
import archer from '../assets/sprites/archer_0.png?inline';
import archerV1 from '../assets/sprites/archer_v1_0.png?inline';
import archerV2 from '../assets/sprites/archer_v2_0.png?inline';
import mage from '../assets/sprites/mage_0.png?inline';
import mageV1 from '../assets/sprites/mage_v1_0.png?inline';
import mageV2 from '../assets/sprites/mage_v2_0.png?inline';
import priest from '../assets/sprites/priest_0.png?inline';
import priestV1 from '../assets/sprites/priest_v1_0.png?inline';
import priestV2 from '../assets/sprites/priest_v2_0.png?inline';
import eagle0 from '../assets/sprites/eagle_0.png?inline';
import eagle1 from '../assets/sprites/eagle_1.png?inline';
import eagle2 from '../assets/sprites/eagle_2.png?inline';
import mouse0 from '../assets/sprites/mouse_0.png?inline';
import mouse1 from '../assets/sprites/mouse_1.png?inline';
import mouse2 from '../assets/sprites/mouse_2.png?inline';
import warrior0 from '../assets/sprites/warrior_0.png?inline';
import warrior1 from '../assets/sprites/warrior_1.png?inline';

/**
 * Авторські спрайти (збираються з assets-src скриптом scripts/build_sprites.py).
 * Дивляться вправо; вліво — flipX. Кадрів може бути 1 (тоді вьюшка робить легкий підстрибунець).
 */
export const SPRITE_ASSETS: Record<string, string[]> = {
  warrior: [warrior0, warrior1],
  knight: [knight],
  knight_v1: [knightV1],
  knight_v2: [knightV2],
  swordsman: [swordsman],
  swordsman_v1: [swordsmanV1],
  swordsman_v2: [swordsmanV2],
  archer: [archer],
  archer_v1: [archerV1],
  archer_v2: [archerV2],
  mage: [mage],
  mage_v1: [mageV1],
  mage_v2: [mageV2],
  priest: [priest],
  priest_v1: [priestV1],
  priest_v2: [priestV2],
  eagle: [eagle0, eagle1, eagle2],
  mouse: [mouse0, mouse1, mouse2],
};

export const spriteKey = (name: string, frame: number): string => `spr_${name}_${frame}`;

/** Завантажує всі спрайти зі словника. Викликається з preload() сцени. */
export function loadSpriteAssets(scene: Phaser.Scene): void {
  for (const [name, urls] of Object.entries(SPRITE_ASSETS)) {
    urls.forEach((url, i) => scene.load.image(spriteKey(name, i), url));
  }
}

/** Кількість кадрів спрайта або 0, якщо його немає (тоді вьюшка малює запасний варіант). */
export function spriteFrames(scene: Phaser.Scene, name: string | undefined): number {
  if (!name) return 0;
  let n = 0;
  while (scene.textures.exists(spriteKey(name, n))) n++;
  return n;
}

/** Коти — рідні 64×64; у світі займають 64/ART_PX_PER_WORLD одиниць (камера кратна — піксель арту цілий). */
export const CAT_SPRITE_PX = 64;
export const CAT_VARIANTS = 3; // базовий + 2 перефарбування (name, name_v1, name_v2)

/** Вариант спрайта для конкретного кота: стабільний за id. */
export function catVariant(base: string, id: number): string {
  const v = id % CAT_VARIANTS;
  return v === 0 ? base : `${base}_v${v}`;
}

/** Масштаб відображення спрайта: коти зменшуються, інші — 1:1. */
export function spriteScale(name: string): number {
  const base = name.replace(/_v\d+$/, '');
  return CAT_BASES.has(base) ? 1 / ART_PX_PER_WORLD : 1;
}
const CAT_BASES = new Set(['knight', 'swordsman', 'archer', 'mage', 'priest']);
