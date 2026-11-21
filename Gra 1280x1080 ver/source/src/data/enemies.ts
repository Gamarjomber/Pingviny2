export interface LungeDef {
  /** Відстань до цілі, з якої починається замах. */
  triggerRange: number;
  /** Телеграф: тривалість замаху перед ривком (удар без попередження заборонений). */
  windup: number;
  speedMult: number;
  duration: number;
  recover: number;
  /** Під час замаху ворог відтягується назад зі швидкістю speed × це. */
  windupRetreat: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  /** Мін. інтервал між ударами одного ворога. */
  hitInterval: number;
  /** Наскільки відкидає самого ворога після удару. */
  selfKnockback: number;
  /** Ймовірність, що ворог іде на голову, а не на найближчого кота хвоста (ТЗ: 2 до 1). */
  headBias: number;
  lunge?: LungeDef;
  /** Назва спрайта зі SPRITE_ASSETS; без неї — запасний процедурний спрайт enemy_<id>. */
  sprite?: string;
  spawnWeight: number;
  /** З якої секунди етапу з'являється. */
  unlockTime: number;
}

/** Старт: 2 типи ворогів (прототип з ТЗ). Змійка ~35% швидша за щурів. */
export const ENEMY_DEFS: Record<string, EnemyDef> = {
  rat: {
    id: 'rat', sprite: 'mouse', name: 'Чумна щур', maxHp: 14, speed: 88, radius: 6,
    contactDamage: 6, hitInterval: 0.6, selfKnockback: 70, headBias: 0.67,
    spawnWeight: 1, unlockTime: 0,
  },
  wolf: {
    id: 'wolf', sprite: 'eagle', name: 'Вовкулак', maxHp: 32, speed: 125, radius: 7,
    contactDamage: 14, hitInterval: 0.8, selfKnockback: 60, headBias: 0.34,
    lunge: { triggerRange: 54, windup: 0.55, speedMult: 3, duration: 0.28, recover: 0.5, windupRetreat: 0.15 },
    spawnWeight: 0.22, unlockTime: 20,
  },
};

export const SPAWN_CONFIG = {
  baseRate: 2.5, // ворогів/с на старті
  rateGrowthPerSec: 0.05, // PressureTimer: чим довше етап, тим більше
  maxEnemies: 250,
  ringMargin: 40, // на скільки далі краю екрана з'являються
};

/** Загальна поведінка ворогів (було зашито в EnemySystem). */
export const ENEMY_BEHAVIOR = {
  separationPush: 12, // сила розштовхування сусідів (px/с на px перекриття)
  separationDistMult: 1.6, // мін. відстань між ворогами = радіус × це
  knockbackDecay: 9, // 1/с: як швидко згасає відкидання
  retargetMin: 0.4, // с: мін. інтервал вибору цілі
  retargetSpread: 0.3, // с: випадкова добавка до інтервалу
};
