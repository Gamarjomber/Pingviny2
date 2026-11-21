import type { SquadConfig } from './squadConfig';

/** Спільне для всіх пресетів: рух, рикошет, відкус. Утримання і бій лишаються як є (не чіпаємо). */
const SHARED: Partial<SquadConfig> = {
  leaderRadius: 7,
  unitRadius: 6,
  dashDuration: 0.4,
  dashCooldown: 3,
  dashSpeedMult: 2.3,
  brakeSpeedMult: 0.45,
  bounceFullReflectUntilDeg: 45,
  bouncePerpExitMinDeg: 10,
  bouncePerpExitMaxDeg: 15,
  splitFirstDetachableIndex: 4,
  splitLinkHitRadius: 3,
  splitCooldown: 0.6,
  lazyBaseRadius: 12,
  lazyPerUnitRadius: 0.5,
  trailResampleStep: 2,
  spiralGrowth: 0.3,
  spiralDecay: 5.8,
};

export interface SquadPreset {
  id: string;
  name: string;
  note: string;
  recommended?: boolean;
  values: Partial<SquadConfig>;
}

const p = (id: string, name: string, note: string, values: Partial<SquadConfig>, recommended = false): SquadPreset => ({
  id,
  name,
  note,
  recommended,
  values: { ...SHARED, ...values },
});

export const SQUAD_PRESETS: SquadPreset[] = [
  p('agile', 'Юркий', 'Бодрий, хвіст гладкий, верьовка гасить сіпання вдвічі. З нього й починай.', {
    leaderSpeed: 75, turnRateDeg: 430, unitSpacing: 12, lazyMaxTurnFraction: 1, lazySmoothing: 16,
    minTurnRadiusBase: 10, minTurnRadiusPerUnit: 0.2,
  }, true),
  p('fast', 'Швидкісний', 'Найшвидший і найплавніший хвіст, драйв.', {
    leaderSpeed: 90, turnRateDeg: 430, unitSpacing: 14, lazyMaxTurnFraction: 1, lazySmoothing: 16,
    minTurnRadiusBase: 12, minTurnRadiusPerUnit: 0.2,
  }),
  p('classic', 'Класика', 'Швидкість як зараз, але з помітною верьовкою.', {
    leaderSpeed: 63, turnRateDeg: 365, unitSpacing: 14, lazyMaxTurnFraction: 1, lazySmoothing: 16,
    minTurnRadiusBase: 10, minTurnRadiusPerUnit: 0.3,
  }),
  p('wide', 'Широкий стрій', 'Між котами проміжки, кожного видно, розворот ширший.', {
    leaderSpeed: 63, turnRateDeg: 305, unitSpacing: 16, lazyMaxTurnFraction: 1, lazySmoothing: 16,
    minTurnRadiusBase: 12, minTurnRadiusPerUnit: 0.3,
  }),
  p('heavy', 'Важкий', "Повільний, в'язкий загін, кінець хвоста сильно захльостує.", {
    leaderSpeed: 55, turnRateDeg: 265, unitSpacing: 16, lazyMaxTurnFraction: 1, lazySmoothing: 22,
    minTurnRadiusBase: 12, minTurnRadiusPerUnit: 0.3,
  }),
  p('dense', 'Щільний', 'Найближчий до теперішнього, верьовка помірна.', {
    leaderSpeed: 63, turnRateDeg: 455, unitSpacing: 12, lazyMaxTurnFraction: 0.8, lazySmoothing: 22,
    minTurnRadiusBase: 8, minTurnRadiusPerUnit: 0.2,
  }),
];

export const DEFAULT_PRESET_ID = 'agile';
export const findPreset = (id: string): SquadPreset | undefined => SQUAD_PRESETS.find((x) => x.id === id);
