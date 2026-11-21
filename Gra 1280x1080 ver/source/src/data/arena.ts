import type { Solid } from '../sim/world/colliders';

export interface ArenaDef {
  width: number;
  height: number;
  solids: Solid[];
  spawn: { x: number; y: number; heading: number };
}

const WALL = 64;

/** Демо-арена. Пізніше сюди замінюється генерацією етапу з даних біому. */
export function buildDemoArena(): ArenaDef {
  const width = 1400;
  const height = 800;
  const solids: Solid[] = [
    // межі поля
    { kind: 'rect', x: -WALL, y: -WALL, w: width + WALL * 2, h: WALL },
    { kind: 'rect', x: -WALL, y: height, w: width + WALL * 2, h: WALL },
    { kind: 'rect', x: -WALL, y: 0, w: WALL, h: height },
    { kind: 'rect', x: width, y: 0, w: WALL, h: height },
    // перешкоди: скелі, колони, руїни
    { kind: 'circle', x: 360, y: 220, r: 26 },
    { kind: 'circle', x: 520, y: 560, r: 34 },
    { kind: 'circle', x: 900, y: 180, r: 30 },
    { kind: 'circle', x: 1100, y: 600, r: 40 },
    { kind: 'rect', x: 640, y: 300, w: 24, h: 120 },
    { kind: 'rect', x: 760, y: 300, w: 24, h: 120 },
    { kind: 'rect', x: 640, y: 290, w: 144, h: 18 },
    { kind: 'rect', x: 220, y: 460, w: 120, h: 20 },
    { kind: 'rect', x: 1000, y: 380, w: 20, h: 140 },
  ];
  return { width, height, solids, spawn: { x: 220, y: height / 2, heading: 0 } };
}
