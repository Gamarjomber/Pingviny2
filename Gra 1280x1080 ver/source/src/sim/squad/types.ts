export interface LeaderState {
  x: number;
  y: number;
  heading: number;
  speed: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  dashTimeLeft: number;
  dashCooldownLeft: number;
  /** Поглинач урону (щит «кільця»): іде перед HP. */
  shield: number;
}

/**
 * Один кіт (Unit).
 * chain — у хвості, hold — у відчепленій групі (б'ється сам), down — упав і лежить з таймером.
 */
export interface UnitState {
  id: number;
  classId: string;
  x: number;
  y: number;
  heading: number;
  hp: number;
  maxHp: number;
  mode: 'chain' | 'hold' | 'down';
  groupId: number | null;
  /** Індекс слоту у фігурі утримання. */
  slot: number;
  /** Скільки разів кіт уже падав (визначає таймер підйому 10→7→5→3). */
  downs: number;
  downTimeLeft: number;
  /** Перезарядка автоатаки. */
  atkCd: number;
  /** Поглинач урону (щит «кільця»): іде перед HP. */
  shield: number;
  /** Щойно повернувся в хвіст (підбір / підйом / кінець кільця) і ще біжить на своє місце: його ланки не відкушуються. */
  unsettled: boolean;
}

/** Відчеплена група (HoldFormation). */
export interface HoldGroup {
  id: number;
  units: UnitState[];
  cx: number;
  cy: number;
  /** Слоти відносно центру. */
  slots: { x: number; y: number }[];
  timeLeft: number;
  age: number;
  /** Група-«кільце» Воїна: стоїть на місці, не гине по таймеру, а повертається в хвіст; торкнутись її раніше не можна. */
  ring?: boolean;
  /** Для кільця: слот, у якому стоїть сам лідер (він теж у формації й нерухомий). */
  leaderSlot?: number;
}
