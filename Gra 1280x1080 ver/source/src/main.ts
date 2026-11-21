import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { SnakeDemoScene } from './scenes/SnakeDemoScene';
import './ui/styles.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0710',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [SnakeDemoScene],
});
