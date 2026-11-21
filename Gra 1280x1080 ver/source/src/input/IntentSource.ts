import type { SteerIntent } from '../sim/intent';

/** Будь-який пристрій введення — миша, геймпад, віртуальний стік — реалізує цей інтерфейс. */
export interface IntentSource {
  read(): SteerIntent;
}
