/**
 * Усі числа фізики змійки живуть тут, а не в коді.
 * Одиниці: пікселі світу, секунди, градуси (де написано). Стартові значення — для підкрутки на прототипі.
 */
export interface SquadConfig {
  // --- лідер ---
  leaderSpeed: number; // px/s
  turnRateDeg: number; // град/с, абсолютна стеля повороту голови (реально обмежує мін. радіус, див. нижче)
  leaderRadius: number;
  leaderMaxHp: number;
  // --- коти ---
  unitRadius: number;
  unitSpacing: number; // жорстка відстань між сусідніми ланками ланцюга
  // --- хвіст: «верьовка» + «рейки» ---
  // Перо (pen) тягнеться за головою на верьовці довжиною LAZY_RADIUS; слід пишеться по перу.
  // LAZY_RADIUS = lazyBaseRadius + lazyPerUnitRadius * кількість котів хвоста.
  lazyBaseRadius: number; // px. ~1/3 кроку між котами: на коротких хвостах слід майже збігається з головою
  lazyPerUnitRadius: number; // px на кота. 20 котів → ~11 px: довгий хвіст інертніший
  /** Верьовка не може бути довшою за цю частку мін. радіуса розвороту, інакше перо збігається до центру кола і хвіст стоїть. */
  lazyMaxTurnFraction: number;
  lazySmoothing: number; // 1/с: pen += (target-pen)*(1-exp(-k*dt)). 22/с ≈ 45 мс інерції
  trailResampleStep: number; // px: нова точка сліду, коли перо зрушило на стільки
  // --- радіус розвороту голови (анти-уроборос) ---
  minTurnRadiusBase: number; // px: найтугіший розворот голови без хвоста
  minTurnRadiusPerUnit: number; // px на кота: довгий хвіст не крутиться на п'ятачку
  spiralGrowth: number; // на скільки зростає радіус за кожне повне коло безперервного повороту (0.3 = +30%)
  spiralDecay: number; // 1/с: як швидко «забувається» накопичений поворот, коли гравець перестав крутити
  // --- рух і здібності ---
  dashDuration: number;
  dashCooldown: number;
  dashSpeedMult: number;
  brakeSpeedMult: number; // «Лицар»: гальмо при затиснутій кнопці
  // --- рикошет ---
  bounceFullReflectUntilDeg: number; // до цього кута до стіни: звичайне відбиття (кут падіння = куту відбиття)
  bouncePerpExitMinDeg: number; // кут виходу від стіни при ударі під 90° (випадково в діапазоні)
  bouncePerpExitMaxDeg: number;
  // --- відкус ---
  splitFirstDetachableIndex: number; // перший кіт хвоста (з 1), якого можна відчепити
  splitLinkHitRadius: number; // «товщина» ланки при перетині головою
  splitCooldown: number;
  rejoinSplitCooldown: number; // с: пауза відкусу після підбору групи / підйому кота / кінця кільця
  // --- фігура утримання / пересборка ---
  holdDuration: number; // макс. час, який відчеплена група тримається, потім усі гинуть
  holdMoveSpeed: number; // швидкість, з якою коти займають фігуру
  holdSpacingMult: number; // відстань між котами фігури (× spacing)
  rejoinGrace: number; // скільки секунд після відкусу пересборка неможлива
  rejoinPad: number; // запас радіуса дотику голови до групи
  catchUpSpeedMult: number; // швидкість, з якою кіт доганяє своє місце в ланцюгу (пересборка, підйом, закриття щілини)
  reviveHpFraction: number; // з яким HP (частка максимуму) встає підібраний кіт

  // --- Лідер: клас «Воїн» (атака хвилею, активка, пасивка «кільце»)
  warriorWaveRange: number; // дальність польоту хвилі і радіус пошуку найближчого ворога, px
  warriorWaveLength: number; // довжина «U» вздовж польоту, px
  warriorWaveWidth: number; // ширина «U», px
  warriorWaveSpeed: number; // px/с
  warriorWaveDamage: number;
  warriorWaveInterval: number; // с
  warriorWaveKnockback: number;
  warriorAbilityDuration: number; // с
  warriorAbilityCooldown: number; // с
  warriorSlowMult: number; // множник швидкості сповільнених ворогів
  warriorSlowRadius: number; // px навколо голови
  warriorShieldHalfArcDeg: number; // півкут переднього щита, °
  warriorWaveSizeMult: number; // збільшення дальності і розміру хвилі під час активки
  warriorTeamDamageMult: number; // бафф урону всієї команди
  warriorTeamCritMult: number; // бафф крит-урону всієї команди
  warriorRingMinUnits: number; // скільки котів мінімум, щоб кільце рахувалось
  warriorRingTouchPad: number; // запас дотику голови до кінця хвоста, px
  warriorRingSpacingMult: number; // відстань між котами в колі = SPACING × це
  warriorRingShieldFraction: number; // щит = частка max HP кожного
  warriorRingShieldDuration: number; // с
  warriorRingCooldown: number; // с
}

export const DEFAULT_SQUAD_CONFIG: SquadConfig = {
  leaderSpeed: 120,
  turnRateDeg: 720,
  leaderRadius: 7,
  leaderMaxHp: 200,

  unitRadius: 6,
  unitSpacing: 12,

  lazyBaseRadius: 4,
  lazyPerUnitRadius: 0.35,
  lazyMaxTurnFraction: 0.6,
  lazySmoothing: 22,
  trailResampleStep: 2,

  minTurnRadiusBase: 12,
  minTurnRadiusPerUnit: 0.5,
  spiralGrowth: 0.3,
  spiralDecay: 1.5,

  dashDuration: 0.4,
  dashCooldown: 3,
  dashSpeedMult: 2.3,
  brakeSpeedMult: 0.45,

  bounceFullReflectUntilDeg: 45,
  bouncePerpExitMinDeg: 15,
  bouncePerpExitMaxDeg: 15,

  splitFirstDetachableIndex: 5,
  splitLinkHitRadius: 3,
  splitCooldown: 0.6,
  rejoinSplitCooldown: 1.5,

  holdDuration: 30,
  holdMoveSpeed: 90,
  holdSpacingMult: 1.5,
  rejoinGrace: 0.7,
  rejoinPad: 2,
  catchUpSpeedMult: 2,
  reviveHpFraction: 0.15,

  warriorWaveRange: 80,
  warriorWaveLength: 34,
  warriorWaveWidth: 14,
  warriorWaveSpeed: 240,
  warriorWaveDamage: 16,
  warriorWaveInterval: 0.7,
  warriorWaveKnockback: 140,
  warriorAbilityDuration: 6,
  warriorAbilityCooldown: 18,
  warriorSlowMult: 0.5,
  warriorSlowRadius: 110,
  warriorShieldHalfArcDeg: 75,
  warriorWaveSizeMult: 1.6,
  warriorTeamDamageMult: 1.25,
  warriorTeamCritMult: 1.5,
  warriorRingMinUnits: 8,
  warriorRingTouchPad: 3,
  warriorRingSpacingMult: 2.4,
  warriorRingShieldFraction: 0.5,
  warriorRingShieldDuration: 10,
  warriorRingCooldown: 90,
};

/** Таймер підйому впалого кота: 1-е падіння 10 с, 2-е 7, 3-є 5, 4-е 3. Далі — смерть одразу. */
export const DOWN_TIMERS: readonly number[] = [10, 7, 5, 3];

export interface Tunable {
  key: keyof SquadConfig;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
}

/** Схема для панелі тюнінгу: нове поле конфігу = один рядок тут, UI будується сам. */
export const SQUAD_TUNABLES: Tunable[] = [
  { group: 'Голова', key: 'leaderSpeed', label: 'Швидкість', min: 40, max: 300, step: 1 },
  { group: 'Голова', key: 'turnRateDeg', label: 'Стеля повороту, °/с', min: 60, max: 1400, step: 5 },
  { group: 'Голова', key: 'leaderRadius', label: 'Радіус голови', min: 3, max: 14, step: 0.5 },
  { group: 'Коти', key: 'unitRadius', label: 'Радіус кота', min: 3, max: 12, step: 0.5 },
  { group: 'Хвіст: верьовка', key: 'unitSpacing', label: 'SPACING, крок котів', min: 6, max: 30, step: 0.5 },
  { group: 'Хвіст: верьовка', key: 'lazyBaseRadius', label: 'BASE_RADIUS', min: 0, max: 30, step: 0.5 },
  { group: 'Хвіст: верьовка', key: 'lazyPerUnitRadius', label: 'PER_UNIT_RADIUS', min: 0, max: 2, step: 0.05 },
  { group: 'Хвіст: верьовка', key: 'lazyMaxTurnFraction', label: 'Макс. частка радіуса розв.', min: 0.2, max: 1, step: 0.05 },
  { group: 'Хвіст: верьовка', key: 'lazySmoothing', label: 'SMOOTHING, 1/с', min: 2, max: 80, step: 1 },
  { group: 'Хвіст: верьовка', key: 'trailResampleStep', label: 'RESAMPLE_STEP, px', min: 0.5, max: 8, step: 0.5 },
  { group: 'Розворот голови', key: 'minTurnRadiusBase', label: 'Мін. радіус, база', min: 4, max: 60, step: 0.5 },
  { group: 'Розворот голови', key: 'minTurnRadiusPerUnit', label: 'Мін. радіус, на кота', min: 0, max: 3, step: 0.05 },
  { group: 'Розворот голови', key: 'spiralGrowth', label: 'Ріст спіралі на коло', min: 0, max: 1.5, step: 0.05 },
  { group: 'Розворот голови', key: 'spiralDecay', label: 'Забування повороту, 1/с', min: 0.1, max: 6, step: 0.1 },
  { group: 'Рух', key: 'dashDuration', label: 'Рывок, тривалість', min: 0.1, max: 1, step: 0.05 },
  { group: 'Рух', key: 'dashCooldown', label: 'Рывок, перезарядка', min: 0.5, max: 8, step: 0.1 },
  { group: 'Рух', key: 'dashSpeedMult', label: 'Рывок, множник', min: 1, max: 5, step: 0.1 },
  { group: 'Рух', key: 'brakeSpeedMult', label: 'Гальмо (Shift)', min: 0.1, max: 1, step: 0.05 },
  { group: 'Рикошет', key: 'bounceFullReflectUntilDeg', label: 'Повне відбиття до, °', min: 10, max: 80, step: 1 },
  { group: 'Рикошет', key: 'bouncePerpExitMinDeg', label: 'Вихід при 90°, від, °', min: 5, max: 60, step: 1 },
  { group: 'Рикошет', key: 'bouncePerpExitMaxDeg', label: 'Вихід при 90°, до, °', min: 5, max: 60, step: 1 },
  { group: 'Відкус', key: 'splitFirstDetachableIndex', label: 'Перший відчіпний кіт', min: 2, max: 12, step: 1 },
  { group: 'Відкус', key: 'splitLinkHitRadius', label: 'Товщина ланки', min: 0.5, max: 8, step: 0.5 },
  { group: 'Відкус', key: 'rejoinSplitCooldown', label: 'Пауза після підбору, с', min: 0, max: 5, step: 0.1 },
  { group: 'Відкус', key: 'splitCooldown', label: 'Пауза між відкусами', min: 0, max: 3, step: 0.1 },
  { group: 'Утримання', key: 'holdDuration', label: 'Макс. час групи, с', min: 5, max: 60, step: 1 },
  { group: 'Утримання', key: 'holdMoveSpeed', label: 'Швидкість у фігуру', min: 20, max: 300, step: 5 },
  { group: 'Утримання', key: 'holdSpacingMult', label: 'Розмах фігури', min: 0.8, max: 3, step: 0.1 },
  { group: 'Утримання', key: 'rejoinGrace', label: 'Пауза пересборки, с', min: 0, max: 3, step: 0.1 },
  { group: 'Утримання', key: 'catchUpSpeedMult', label: 'Доганяння місця в ланцюгу', min: 1, max: 4, step: 0.1 },
  { group: 'Воїн: атака', key: 'warriorWaveRange', label: 'Дальність хвилі', min: 20, max: 200, step: 5 },
  { group: 'Воїн: атака', key: 'warriorWaveLength', label: 'Довжина «U»', min: 8, max: 100, step: 1 },
  { group: 'Воїн: атака', key: 'warriorWaveWidth', label: 'Ширина «U»', min: 4, max: 60, step: 1 },
  { group: 'Воїн: атака', key: 'warriorWaveSpeed', label: 'Швидкість хвилі', min: 60, max: 600, step: 10 },
  { group: 'Воїн: атака', key: 'warriorWaveDamage', label: 'Урон', min: 1, max: 80, step: 1 },
  { group: 'Воїн: атака', key: 'warriorWaveInterval', label: 'Інтервал, с', min: 0.15, max: 3, step: 0.05 },
  { group: 'Воїн: активка (F)', key: 'warriorAbilityDuration', label: 'Тривалість, с', min: 1, max: 20, step: 0.5 },
  { group: 'Воїн: активка (F)', key: 'warriorAbilityCooldown', label: 'Перезарядка, с', min: 2, max: 90, step: 1 },
  { group: 'Воїн: активка (F)', key: 'warriorSlowMult', label: 'Сповільнення (множник)', min: 0.1, max: 1, step: 0.05 },
  { group: 'Воїн: активка (F)', key: 'warriorSlowRadius', label: 'Радіус сповільнення', min: 30, max: 300, step: 5 },
  { group: 'Воїн: активка (F)', key: 'warriorShieldHalfArcDeg', label: 'Півкут щита, °', min: 20, max: 180, step: 5 },
  { group: 'Воїн: активка (F)', key: 'warriorWaveSizeMult', label: 'Розмір хвилі ×', min: 1, max: 3, step: 0.05 },
  { group: 'Воїн: активка (F)', key: 'warriorTeamDamageMult', label: 'Бафф урону ×', min: 1, max: 3, step: 0.05 },
  { group: 'Воїн: активка (F)', key: 'warriorTeamCritMult', label: 'Бафф крит-урону ×', min: 1, max: 3, step: 0.05 },
  { group: 'Воїн: кільце', key: 'warriorRingMinUnits', label: 'Мін. котів', min: 3, max: 30, step: 1 },
  { group: 'Воїн: кільце', key: 'warriorRingTouchPad', label: 'Запас дотику, px', min: 0, max: 12, step: 0.5 },
  { group: 'Воїн: кільце', key: 'warriorRingSpacingMult', label: 'Відстань у колі ×', min: 1, max: 5, step: 0.1 },
  { group: 'Воїн: кільце', key: 'warriorRingShieldFraction', label: 'Щит, частка max HP', min: 0.1, max: 2, step: 0.05 },
  { group: 'Воїн: кільце', key: 'warriorRingShieldDuration', label: 'Щит, с', min: 2, max: 30, step: 1 },
  { group: 'Воїн: кільце', key: 'warriorRingCooldown', label: 'Перезарядка, с', min: 5, max: 300, step: 5 },
  { group: 'Бій', key: 'reviveHpFraction', label: 'HP після підйому', min: 0.05, max: 0.6, step: 0.01 },
];
