/**
 * Єдиний вхід у симуляцію від гравця. Миша, стік, тач — усе зводиться до цього.
 * Симуляція нічого не знає про пристрої введення.
 */
export interface SteerIntent {
  /** Бажаний напрямок голови (рад.), напр. «до курсора». null — керуємо за turnAxis. */
  targetAngle: number | null;
  /** -1…1: поворот ліворуч/праворуч, якщо targetAngle == null. */
  turnAxis: number;
  dash: boolean;
  /** Спроможність лідера «гальмо» (Лицар). */
  brake: boolean;
  /** Активна здатність класу лідера (Воїн: F). Необовʼязково, щоб старі джерела вводу не ламались. */
  ability?: boolean;
}

export const NEUTRAL_INTENT: SteerIntent = { targetAngle: null, turnAxis: 0, dash: false, brake: false };
