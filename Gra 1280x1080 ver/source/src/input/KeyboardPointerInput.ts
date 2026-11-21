import Phaser from 'phaser';
import type { SteerIntent } from '../sim/intent';
import type { IntentSource } from './IntentSource';

/** ПК: поворот за курсором (як у Slither.io) або клавішами A/D, ←/→. Пробіл — ривок, Shift — гальмо. */
export class KeyboardPointerInput implements IntentSource {
  private readonly keys: Record<'left' | 'right' | 'a' | 'd' | 'space' | 'shift' | 'f', Phaser.Input.Keyboard.Key>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getLeaderPos: () => { x: number; y: number },
    private readonly deadzone = 6,
  ) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      space: kb.addKey(K.SPACE),
      shift: kb.addKey(K.SHIFT),
      f: kb.addKey(K.F),
    };
  }

  read(): SteerIntent {
    const k = this.keys;
    const axis = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    let targetAngle: number | null = null;
    if (axis === 0) {
      const p = this.scene.input.activePointer;
      const w = this.scene.cameras.main.getWorldPoint(p.x, p.y);
      const l = this.getLeaderPos();
      if (Math.hypot(w.x - l.x, w.y - l.y) > this.deadzone) targetAngle = Math.atan2(w.y - l.y, w.x - l.x);
    }
    return { targetAngle, turnAxis: axis, dash: k.space.isDown, brake: k.shift.isDown, ability: k.f.isDown };
  }
}
