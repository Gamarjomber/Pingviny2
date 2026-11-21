import Phaser from 'phaser';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../sim/events';
import type { CameraRig } from './CameraRig';

const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '9px', stroke: '#120d1a', strokeThickness: 2 };

/** Сочність: реакція на події симуляції. Звук і складніші частинки підключаються сюди ж. */
export function attachJuice(scene: Phaser.Scene, bus: EventBus<GameEvents>, camera: CameraRig): void {
  const ring = (x: number, y: number, color: number, r0: number, r1: number, ms: number) => {
    const c = scene.add.circle(x, y, r0).setStrokeStyle(2, color, 1).setDepth(30);
    scene.tweens.add({
      targets: c,
      radius: r1,
      alpha: 0,
      duration: ms,
      ease: 'Quad.easeOut',
      onUpdate: () => c.setRadius(c.radius),
      onComplete: () => c.destroy(),
    });
  };

  const floatText = (x: number, y: number, text: string, color: string) => {
    const t = scene.add.text(x, y - 8, text, { ...TEXT_STYLE, color }).setOrigin(0.5).setDepth(40);
    scene.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  };

  const burst = (x: number, y: number, color: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.random() * 12;
      const r = scene.add.rectangle(x, y, 2, 2, color).setDepth(25);
      scene.tweens.add({
        targets: r,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 300 + Math.random() * 150,
        onComplete: () => r.destroy(),
      });
    }
  };

  const slash = (x: number, y: number, tx: number, ty: number) => {
    const a = Math.atan2(ty - y, tx - x);
    const r = scene.add.rectangle(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 14, 2, 0xffffff).setRotation(a).setDepth(26);
    scene.tweens.add({ targets: r, scaleX: 1.6, alpha: 0, duration: 130, onComplete: () => r.destroy() });
  };

  bus.on('leaderSlash', () => camera.shake(40, 0.0015));
  bus.on('abilityStart', (e) => {
    ring(e.x, e.y, 0x66ccff, 8, 90, 450);
    camera.shake(100, 0.004);
  });
  bus.on('abilityEnd', (e) => ring(e.x, e.y, 0x557799, 20, 30, 250));
  bus.on('blocked', (e) => {
    if (e.kind === 'front') {
      floatText(e.x, e.y, 'блок', '#66ccff');
      ring(e.x, e.y, 0x66ccff, 6, 16, 180);
    } else {
      floatText(e.x, e.y, `-${Math.round(e.amount)}`, '#8fd1ff');
    }
  });
  bus.on('ringClosed', (e) => {
    camera.shake(160, 0.006);
    ring(e.x, e.y, 0x66ccff, 10, 70, 600);
    ring(e.x, e.y, 0xffd86b, 6, 46, 450);
    floatText(e.x, e.y - 8, 'КІЛЬЦЕ!', '#66ccff');
  });

  bus.on('bounce', (e) => {
    camera.shake(90, 0.004);
    ring(e.x - e.nx * 6, e.y - e.ny * 6, 0xffffff, 3, 16, 200);
  });
  bus.on('split', (e) => {
    camera.shake(120, 0.005);
    ring(e.x, e.y, 0xff5577, 6, 34, 320);
  });
  bus.on('rejoin', () => camera.shake(60, 0.003));
  bus.on('holdExpired', (e) => ring(e.x, e.y, 0x777777, 10, 40, 500));
  bus.on('dash', (e) => ring(e.x, e.y, 0x8fd1ff, 4, 22, 240));

  bus.on('damage', (e) => {
    const n = String(Math.round(e.amount));
    if (e.kind === 'enemy') floatText(e.x, e.y, n, '#ffffff');
    else if (e.kind === 'unit') floatText(e.x, e.y, n, '#ff6b6b');
    else {
      floatText(e.x, e.y, n, '#ffb347');
      camera.shake(110, 0.006);
    }
  });
  bus.on('heal', (e) => floatText(e.x, e.y, `+${Math.round(e.amount)}`, '#7dffb0'));
  bus.on('attack', (e) => {
    if (e.kind === 'melee') slash(e.x, e.y, e.tx, e.ty);
    else if (e.kind === 'heal') ring(e.tx, e.ty, 0x7dffb0, 3, 12, 260);
  });
  bus.on('enemyDied', (e) => burst(e.x, e.y, 0x8a5a3c, 5));
  bus.on('unitDown', (e) => {
    camera.shake(120, 0.005);
    ring(e.x, e.y, 0xe05050, 4, 24, 400);
  });
  bus.on('unitRevived', () => camera.shake(60, 0.003));
  bus.on('unitDied', (e) => burst(e.x, e.y, 0x777777, 8));
}
