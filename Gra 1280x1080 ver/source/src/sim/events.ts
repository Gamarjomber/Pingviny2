/** Усі події симуляції. Рендер, звук, UI, діалоги підписуються на них, симуляція нічого про них не знає. */
export interface GameEvents {
  bounce: { x: number; y: number; nx: number; ny: number; angle: number };
  dash: { x: number; y: number };
  split: { groupId: number; count: number; x: number; y: number };
  rejoin: { groupId: number; count: number };
  /** Час групи вичерпано: усі її живі коти гинуть. */
  holdExpired: { groupId: number; count: number; x: number; y: number };
  /** Кіт упав (0 HP): лежить на землі з таймером, підібрати можна головою. */
  unitDown: { unitId: number; classId: string; x: number; y: number; timer: number };
  unitRevived: { unitId: number; classId: string; hp: number };
  /** Кіт помер назавжди. */
  unitDied: { unitId: number; classId: string; x: number; y: number };
  damage: { x: number; y: number; amount: number; kind: 'unit' | 'leader' | 'enemy' };
  heal: { x: number; y: number; amount: number };
  attack: { kind: 'melee' | 'projectile' | 'heal'; x: number; y: number; tx: number; ty: number; color: number };
  enemyDied: { x: number; y: number; defId: string };
  /** Лідер випустив хвилю в бік найближчого ворога. */
  leaderSlash: { x: number; y: number; heading: number };
  abilityStart: { x: number; y: number };
  abilityEnd: { x: number; y: number };
  /** Передній щит або поглинач прийняв удар. */
  blocked: { x: number; y: number; amount: number; kind: 'front' | 'absorb' };
  /** Кільце замкнуто: коти строяться в коло, видано щит. */
  ringClosed: { x: number; y: number; count: number };
  gameOver: { x: number; y: number };
}
