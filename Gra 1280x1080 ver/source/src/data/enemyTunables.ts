import { ENEMY_BEHAVIOR, ENEMY_DEFS, SPAWN_CONFIG } from './enemies';

/** Параметр ворога для живої панелі: читання/запис напряму в дані (ENEMY_DEFS, SPAWN_CONFIG, ENEMY_BEHAVIOR). */
export interface EnemyTunable {
  /** Унікальний ключ для збереження, напр. 'rat.maxHp'. */
  key: string;
  group: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get(): number;
  set(v: number): void;
}

type DefNum = 'maxHp' | 'speed' | 'radius' | 'contactDamage' | 'hitInterval' | 'selfKnockback' | 'headBias' | 'spawnWeight' | 'unlockTime';
type LungeNum = 'triggerRange' | 'windup' | 'speedMult' | 'duration' | 'recover' | 'windupRetreat';

const DEF_FIELDS: { k: DefNum; label: string; min: number; max: number; step: number }[] = [
  { k: 'maxHp', label: 'HP (для нових)', min: 1, max: 300, step: 1 },
  { k: 'speed', label: 'Швидкість', min: 10, max: 300, step: 1 },
  { k: 'radius', label: 'Радіус', min: 3, max: 12, step: 0.5 },
  { k: 'contactDamage', label: 'Контактний урон', min: 0, max: 60, step: 1 },
  { k: 'hitInterval', label: 'Інтервал ударів, с', min: 0.1, max: 3, step: 0.05 },
  { k: 'selfKnockback', label: 'Відскок після удару', min: 0, max: 300, step: 5 },
  { k: 'headBias', label: 'Шанс іти на голову', min: 0, max: 1, step: 0.01 },
  { k: 'spawnWeight', label: 'Вага спавну', min: 0, max: 3, step: 0.01 },
  { k: 'unlockTime', label: 'З якої секунди', min: 0, max: 300, step: 1 },
];
const LUNGE_FIELDS: { k: LungeNum; label: string; min: number; max: number; step: number }[] = [
  { k: 'triggerRange', label: 'Дистанція замаху', min: 10, max: 200, step: 1 },
  { k: 'windup', label: 'Замах (телеграф), с', min: 0.1, max: 2, step: 0.05 },
  { k: 'speedMult', label: 'Множник швидкості ривка', min: 1, max: 8, step: 0.1 },
  { k: 'duration', label: 'Тривалість ривка, с', min: 0.05, max: 1, step: 0.01 },
  { k: 'recover', label: 'Відновлення, с', min: 0, max: 2, step: 0.05 },
  { k: 'windupRetreat', label: 'Відтягування в замаху', min: 0, max: 1, step: 0.01 },
];

export const ENEMY_TUNABLES: EnemyTunable[] = [];

for (const def of Object.values(ENEMY_DEFS)) {
  for (const f of DEF_FIELDS) {
    ENEMY_TUNABLES.push({
      key: `${def.id}.${f.k}`, group: `Ворог: ${def.name}`, label: f.label, min: f.min, max: f.max, step: f.step,
      get: () => def[f.k], set: (v) => { def[f.k] = v; },
    });
  }
  const lunge = def.lunge;
  if (lunge) {
    for (const f of LUNGE_FIELDS) {
      ENEMY_TUNABLES.push({
        key: `${def.id}.lunge.${f.k}`, group: `Ворог: ${def.name}, ривок`, label: f.label, min: f.min, max: f.max, step: f.step,
        get: () => lunge[f.k], set: (v) => { lunge[f.k] = v; },
      });
    }
  }
}

const SPAWN_FIELDS: { k: keyof typeof SPAWN_CONFIG; label: string; min: number; max: number; step: number }[] = [
  { k: 'baseRate', label: 'Ворогів/с на старті', min: 0, max: 20, step: 0.1 },
  { k: 'rateGrowthPerSec', label: 'Приріст за секунду', min: 0, max: 0.5, step: 0.005 },
  { k: 'maxEnemies', label: 'Максимум ворогів', min: 10, max: 600, step: 10 },
  { k: 'ringMargin', label: 'Відступ від краю екрана', min: 0, max: 200, step: 5 },
];
for (const f of SPAWN_FIELDS) {
  ENEMY_TUNABLES.push({
    key: `spawn.${f.k}`, group: 'Вороги: спавн', label: f.label, min: f.min, max: f.max, step: f.step,
    get: () => SPAWN_CONFIG[f.k], set: (v) => { SPAWN_CONFIG[f.k] = v; },
  });
}

const BEHAVIOR_FIELDS: { k: keyof typeof ENEMY_BEHAVIOR; label: string; min: number; max: number; step: number }[] = [
  { k: 'separationPush', label: 'Розштовхування', min: 0, max: 40, step: 1 },
  { k: 'separationDistMult', label: 'Мін. відстань (× радіус)', min: 1, max: 3, step: 0.05 },
  { k: 'knockbackDecay', label: 'Згасання відкидання, 1/с', min: 1, max: 30, step: 0.5 },
  { k: 'retargetMin', label: 'Вибір цілі, мін. інтервал', min: 0.1, max: 3, step: 0.05 },
  { k: 'retargetSpread', label: 'Вибір цілі, розкид', min: 0, max: 2, step: 0.05 },
];
for (const f of BEHAVIOR_FIELDS) {
  ENEMY_TUNABLES.push({
    key: `behavior.${f.k}`, group: 'Вороги: поведінка', label: f.label, min: f.min, max: f.max, step: f.step,
    get: () => ENEMY_BEHAVIOR[f.k], set: (v) => { ENEMY_BEHAVIOR[f.k] = v; },
  });
}

/** Значення за замовчуванням — знімок на момент завантаження модуля (до будь-яких змін панеллю). */
const DEFAULTS = new Map(ENEMY_TUNABLES.map((t) => [t.key, t.get()]));
const STORAGE_KEY = 'gra.enemyConfig.v1';

/** Накладає збережені значення на дані ворогів. Викликати до створення Sim. */
export function loadEnemyConfig(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    for (const t of ENEMY_TUNABLES) if (typeof saved[t.key] === 'number') t.set(saved[t.key] as number);
  } catch {
    /* storage недоступний */
  }
}

export function saveEnemyConfig(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(ENEMY_TUNABLES.map((t) => [t.key, t.get()]))));
  } catch {
    /* ignore */
  }
}

export function resetEnemyConfig(): void {
  for (const t of ENEMY_TUNABLES) t.set(DEFAULTS.get(t.key)!);
  saveEnemyConfig();
}
