import type { SteerIntent } from '../intent';

/**
 * Клас лідера (Воїн та майбутні): власна атака, активна здатність, пасивка.
 * Живе окремо від Squad і лише впливає на нього через модифікатори та щити.
 */
export interface LeaderClassSystem {
  readonly id: string;
  /** Тогл: вимкнений клас нічого не робить, а всі його ефекти знімаються. */
  enabled: boolean;
  setEnabled(on: boolean): void;
  update(dt: number, intent: SteerIntent): void;
}
