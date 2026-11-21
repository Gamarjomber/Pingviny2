export interface AttackDef {
  kind: 'none' | 'melee' | 'projectile' | 'heal';
  /** Радіус від точки самого кота (кожен кіт — турель зі своїм радіусом). */
  range: number;
  damage: number;
  interval: number;
  /** Ближній бій: скільки ворогів зачіпає один удар. */
  maxTargets?: number;
  projectileSpeed?: number;
  /** Скільки ворогів снаряд пробиває насквозь (0 — зупиняється на першому). */
  pierce?: number;
  color?: number;
  healAmount?: number;
}

export interface UnitClassDef {
  id: string;
  name: string;
  /** Один колір на клас — його ж використовує HP-ланцюжок. */
  color: number;
  role: 'melee' | 'ranged' | 'mystic';
  maxHp: number;
  attack: AttackDef;
  /** Назва спрайта зі SPRITE_ASSETS. Без неї кіт малюється кольоровим квадратом. */
  sprite?: string;
}

export const UNIT_CLASSES: Record<string, UnitClassDef> = {
  knight: {
    id: 'knight', sprite: 'knight', name: 'Лицар', color: 0x5c7fb8, role: 'melee', maxHp: 160,
    attack: { kind: 'melee', range: 20, damage: 10, interval: 0.8, maxTargets: 1 },
  },
  swordsman: {
    id: 'swordsman', sprite: 'swordsman', name: 'Злодійка', color: 0xe8702a, role: 'melee', maxHp: 110,
    attack: { kind: 'melee', range: 24, damage: 9, interval: 0.45, maxTargets: 3 },
  },
  archer: {
    id: 'archer', sprite: 'archer', name: 'Мисливиця', color: 0xc99a6b, role: 'ranged', maxHp: 70,
    attack: { kind: 'projectile', range: 140, damage: 8, interval: 0.8, projectileSpeed: 260, pierce: 0, color: 0xe8d8a0 },
  },
  mage: {
    id: 'mage', sprite: 'mage', name: 'Чарівниця', color: 0x8a52b8, role: 'mystic', maxHp: 60,
    attack: { kind: 'projectile', range: 120, damage: 16, interval: 1.5, projectileSpeed: 150, pierce: 1, color: 0xff7a30 },
  },
  priest: {
    id: 'priest', sprite: 'priest', name: 'Жриця', color: 0xe8e4dc, role: 'mystic', maxHp: 80,
    attack: { kind: 'heal', range: 70, damage: 0, interval: 1.5, healAmount: 8 },
  },
};

export const DEMO_TAIL_ORDER = ['knight', 'swordsman', 'archer', 'mage', 'priest'];
